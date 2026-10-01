import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

interface IdempotencyRecord {
  key: string;
  payloadHash: string;
  statusCode: number;
  responseBody: any;
  headers: Record<string, string>;
  createdAt: number;
}

// In-Memory Idempotency Cache (supports 24-hour network retry windows)
const idempotencyStore = new Map<string, IdempotencyRecord>();
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Computes a SHA-256 checksum of any arbitrary payload object or string.
 */
export function computePayloadSha256(payload: any): string {
  const normalized = typeof payload === 'string' ? payload : JSON.stringify(payload || {});
  return crypto.createHash('sha256').update(normalized).digest('hex');
}

/**
 * SHA-256 Request Idempotency Filter
 * Conforms to: Section 3.4.2 (Item 4), Section 4.6.3 (Step 3), Section 4.6.5, & TC-09.
 *
 * Verifies (UUID + SHA256) tuple before permitting cloud database ingestion.
 * Prevents duplicate in-flight or replayed network mutations under intermittent connectivity.
 */
export function idempotencyFilter(options?: { headerName?: string; hashHeaderName?: string }) {
  const keyHeader = options?.headerName?.toLowerCase() || 'x-idempotency-key';
  const hashHeader = options?.hashHeaderName?.toLowerCase() || 'x-payload-hash';

  return (req: Request, res: Response, next: NextFunction) => {
    // Only inspect mutating methods
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const idempotencyKey = (
      req.headers[keyHeader] ||
      (req.body && (req.body.idempotencyKey || req.body.uuid || req.body.syncId))
    ) as string | undefined;

    const providedHash = (
      req.headers[hashHeader] ||
      (req.body && (req.body.payloadHash || req.body.sha256))
    ) as string | undefined;

    const calculatedHash = computePayloadSha256(req.body);

    // If client supplied an explicit hash header, ensure it matches actual body
    if (providedHash && providedHash.toLowerCase() !== calculatedHash.toLowerCase()) {
      return res.status(400).json({
        success: false,
        code: 'PAYLOAD_HASH_MISMATCH',
        message: 'Cryptographic payload checksum verification failed. Body does not match provided SHA-256.',
        calculatedHash,
        providedHash,
      });
    }

    // If no idempotency key provided, proceed normally without blocking
    if (!idempotencyKey) {
      res.setHeader('X-Payload-Hash', calculatedHash);
      return next();
    }

    // Clean up expired records
    const now = Date.now();
    for (const [key, record] of idempotencyStore.entries()) {
      if (now - record.createdAt > IDEMPOTENCY_TTL_MS) {
        idempotencyStore.delete(key);
      }
    }

    // Check if key was already processed
    const existing = idempotencyStore.get(idempotencyKey);
    if (existing) {
      // If same key but different payload, reject as conflict
      if (existing.payloadHash !== calculatedHash) {
        return res.status(409).json({
          success: false,
          code: 'IDEMPOTENCY_KEY_REUSED',
          message: 'Idempotency key has already been used with a different request payload.',
          idempotencyKey,
        });
      }

      // Replay identical response
      res.setHeader('X-Cache-Lookup', 'HIT (Idempotent replay detected)');
      res.setHeader('X-Idempotency-Key', idempotencyKey);
      res.setHeader('X-Payload-Hash', calculatedHash);
      return res.status(existing.statusCode).json(existing.responseBody);
    }

    // Intercept response to cache for future replays
    const originalJson = res.json.bind(res);
    res.json = ((body: any) => {
      // Only cache successful or recognized statuses
      if (res.statusCode >= 200 && res.statusCode < 400) {
        idempotencyStore.set(idempotencyKey, {
          key: idempotencyKey,
          payloadHash: calculatedHash,
          statusCode: res.statusCode,
          responseBody: body,
          headers: {},
          createdAt: Date.now(),
        });
      }
      res.setHeader('X-Cache-Lookup', 'MISS (First Execution)');
      res.setHeader('X-Idempotency-Key', idempotencyKey);
      res.setHeader('X-Payload-Hash', calculatedHash);
      return originalJson(body);
    }) as any;

    return next();
  };
}

export const clearIdempotencyCache = () => idempotencyStore.clear();
export const getIdempotencyRecord = (key: string) => idempotencyStore.get(key);
