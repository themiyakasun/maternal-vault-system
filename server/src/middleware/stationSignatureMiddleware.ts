import type { Request, Response, NextFunction } from 'express';
import { stationCryptoService } from '../services/stationCryptoService.js';
import { computePayloadSha256 } from './idempotencyMiddleware.js';

export interface StationVerificationOptions {
  requireSignature?: boolean;
}

/**
 * Station Cryptographic Signature Verification Middleware
 * Section 4.5.1 (Figure METHODOLOGY.2) & Section 4.8.1 (Table METHODOLOGY.7)
 *
 * Verifies that outgoing sync bundles originate from an authorized, cryptographically recognized clinic station.
 */
export function verifyStationSignature(options?: StationVerificationOptions) {
  const isStrict = options?.requireSignature === true;

  return (req: Request, res: Response, next: NextFunction) => {
    // Only inspect mutations
    if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
      return next();
    }

    const clinicId = (req.headers['x-station-key'] || req.headers['x-clinic-id'] || req.body?.clinicId) as string | undefined;
    const timestamp = req.headers['x-station-timestamp'] as string | undefined;
    const signature = req.headers['x-station-signature'] as string | undefined;

    // If headers are missing
    if (!signature || !timestamp || !clinicId) {
      if (isStrict) {
        return res.status(401).json({
          success: false,
          code: 'STATION_SIGNATURE_REQUIRED',
          message: 'Station cryptographic signing required for authoritative clinical sync ingestion (X-Station-Key, X-Station-Timestamp, X-Station-Signature).',
        });
      }
      // Non-breaking fallback: allow requests without signature in development/testing
      return next();
    }

    const payloadHash = (req.headers['x-payload-hash'] as string) || computePayloadSha256(req.body);
    const verification = stationCryptoService.verifySignature(clinicId, timestamp, payloadHash, signature);

    if (!verification.valid) {
      return res.status(403).json({
        success: false,
        code: 'STATION_SIGNATURE_INVALID',
        message: verification.error || 'Cryptographic station signature verification failed.',
        clinicId,
      });
    }

    // Attach verified station provenance metadata
    (req as any).stationVerified = true;
    (req as any).stationClinicId = clinicId;
    res.setHeader('X-Station-Provenance', 'VERIFIED_AUTHORIZED_STATION');

    return next();
  };
}
