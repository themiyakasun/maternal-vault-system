import crypto from 'crypto';

const DEFAULT_STATION_KEY = process.env.STATION_MASTER_KEY || 'MATERNA_VAULT_SECURE_PHM_MUM_71_SECRET_KEY';
const SIGNATURE_WINDOW_MS = 15 * 60 * 1000; // 15-minute replay window tolerance

/**
 * Station Cryptographic Signing Engine
 * Conforms to: Section 4.5.1 (Fig METHODOLOGY.2) & Section 4.8.1 (Table METHODOLOGY.7)
 *
 * MOH Clinic Station holds sole cryptographic authority to generate official clinical updates.
 */
export const stationCryptoService = {
  /**
   * Generates a tamper-proof HMAC-SHA256 signature for outgoing clinical synchronization payloads.
   */
  signPayload(
    clinicId: string,
    timestamp: string,
    payloadHash: string,
    stationKey: string = DEFAULT_STATION_KEY
  ): string {
    const canonicalMessage = `${clinicId}:${timestamp}:${payloadHash}`;
    return crypto.createHmac('sha256', stationKey).update(canonicalMessage).digest('hex');
  },

  /**
   * Cryptographically verifies incoming station signatures against the clinic's station key.
   */
  verifySignature(
    clinicId: string,
    timestamp: string,
    payloadHash: string,
    signature: string,
    stationKey: string = DEFAULT_STATION_KEY
  ): { valid: boolean; error?: string } {
    if (!signature || !timestamp || !clinicId) {
      return { valid: false, error: 'Missing mandatory station cryptographic headers.' };
    }

    // Check timestamp drift to prevent historical replay attacks
    const reqTime = new Date(timestamp).getTime();
    if (isNaN(reqTime)) {
      return { valid: false, error: 'Malformed station timestamp format.' };
    }

    const drift = Math.abs(Date.now() - reqTime);
    if (drift > SIGNATURE_WINDOW_MS) {
      return { valid: false, error: `Station timestamp drift too large (${Math.round(drift / 1000)}s). Max allowed: 900s.` };
    }

    const expectedSignature = this.signPayload(clinicId, timestamp, payloadHash, stationKey);

    // Constant-time buffer comparison to prevent timing attacks
    const sigBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (sigBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
      return { valid: false, error: 'Cryptographic signature mismatch. Station key or payload tampered.' };
    }

    return { valid: true };
  },
};
