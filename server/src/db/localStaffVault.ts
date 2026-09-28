import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { StaffUser, Clinic } from '../types/auth.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const VAULT_FILE = path.join(DATA_DIR, 'staff_vault_encrypted.db');
const STATION_KEY = process.env.STATION_MASTER_KEY || 'MATERNA_VAULT_SECURE_PHM_MUM_71_SECRET_KEY';
const ALGORITHM = 'aes-256-gcm';

interface EncryptedVaultPayload {
  version: number;
  cipher: string;
  iv: string;
  authTag: string;
  salt: string;
  checksum: string;
  updatedAt: string;
  encryptedData: string;
}

interface VaultData {
  tenants: Omit<Clinic, 'staff'>[];
  staffByClinic: Record<string, StaffUser[]>;
  offlineAuditQueue: Array<{
    staffId: string;
    clinicId: string;
    action: string;
    status: string;
    ipAddress?: string;
    details?: any;
    timestamp: string;
  }>;
}

// In-Memory cache of decrypted staff vault
let localVaultCache: VaultData = {
  tenants: [],
  staffByClinic: {},
  offlineAuditQueue: [],
};

function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(STATION_KEY, salt, 100000, 32, 'sha512');
}

function encryptAndSaveVault(data: VaultData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const jsonString = JSON.stringify(data);
    const salt = crypto.randomBytes(16);
    const key = deriveKey(salt);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');

    const payload: EncryptedVaultPayload = {
      version: 1,
      cipher: ALGORITHM,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: salt.toString('hex'),
      checksum,
      updatedAt: new Date().toISOString(),
      encryptedData: encrypted,
    };

    fs.writeFileSync(VAULT_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (err) {
    console.error('Failed to save encrypted staff vault:', err);
  }
}

function getEmptyVault(): VaultData {
  return {
    tenants: [],
    staffByClinic: {},
    offlineAuditQueue: [],
  };
}

function decryptAndLoadVault(): VaultData {
  try {
    if (!fs.existsSync(VAULT_FILE)) {
      const initial = getEmptyVault();
      encryptAndSaveVault(initial);
      return initial;
    }

    const raw = fs.readFileSync(VAULT_FILE, 'utf8');
    const payload: EncryptedVaultPayload = JSON.parse(raw);

    const salt = Buffer.from(payload.salt, 'hex');
    const key = deriveKey(salt);
    const iv = Buffer.from(payload.iv, 'hex');
    const authTag = Buffer.from(payload.authTag, 'hex');

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(payload.encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    const calculatedChecksum = crypto.createHash('sha256').update(decrypted).digest('hex');
    if (calculatedChecksum !== payload.checksum) {
      throw new Error('Local staff vault integrity violation: checksum mismatch');
    }

    return JSON.parse(decrypted);
  } catch (err) {
    console.warn('⚠️  Could not decrypt existing staff vault (station key changed or fresh deployment). Initializing empty staff vault with active station key.');
    const initial = getEmptyVault();
    try {
      encryptAndSaveVault(initial);
    } catch (saveErr) {
      console.warn('Could not persist empty staff vault:', saveErr);
    }
    return initial;
  }
}

// Initialize cache on startup
localVaultCache = decryptAndLoadVault();

export const localStaffVault = {
  /**
   * Save / cache tenant clinics list into local encrypted vault.
   */
  saveTenants(tenants: Omit<Clinic, 'staff'>[]): void {
    localVaultCache.tenants = tenants;
    encryptAndSaveVault(localVaultCache);
  },

  /**
   * Get cached tenant clinics list from local encrypted vault.
   */
  getTenants(): Omit<Clinic, 'staff'>[] {
    return localVaultCache.tenants || [];
  },

  /**
   * Save / replace the staff list for a clinic into local encrypted vault.
   */
  saveStaffForClinic(clinicId: string, staff: StaffUser[]): void {
    localVaultCache.staffByClinic[clinicId] = staff;
    encryptAndSaveVault(localVaultCache);
  },

  /**
   * Replace all staff members across all clinics in the local encrypted vault.
   */
  saveAllStaff(staffByClinic: Record<string, StaffUser[]>): void {
    localVaultCache.staffByClinic = staffByClinic;
    encryptAndSaveVault(localVaultCache);
  },

  /**
   * Add or update an individual staff member in the local encrypted vault.
   */
  upsertStaffUser(staff: StaffUser): void {
    const list = localVaultCache.staffByClinic[staff.clinicId] || [];
    const index = list.findIndex((s) => s.id === staff.id);
    if (index >= 0) {
      list[index] = { ...list[index], ...staff };
    } else {
      list.push(staff);
    }
    localVaultCache.staffByClinic[staff.clinicId] = list;
    encryptAndSaveVault(localVaultCache);
  },

  /**
   * Get all staff members for a specific clinic tenant (scoped).
   */
  getStaffForClinic(clinicId: string): StaffUser[] {
    return localVaultCache.staffByClinic[clinicId] || [];
  },

  /**
   * Find a specific staff user by clinicId and staffId.
   */
  findStaffUser(clinicId: string, staffId: string): StaffUser | null {
    const list = localVaultCache.staffByClinic[clinicId] || [];
    return list.find((s) => s.id === staffId) || null;
  },

  /**
   * Queue an audit log entry created while offline.
   */
  recordOfflineAudit(audit: {
    staffId: string;
    clinicId: string;
    action: string;
    status: string;
    ipAddress?: string;
    details?: any;
  }): void {
    localVaultCache.offlineAuditQueue.push({
      ...audit,
      timestamp: new Date().toISOString(),
    });
    encryptAndSaveVault(localVaultCache);
  },

  /**
   * Flush queued offline audit logs to PostgreSQL when connection is restored.
   */
  async flushOfflineAuditsToPostgres(pool: any): Promise<number> {
    if (!localVaultCache.offlineAuditQueue || localVaultCache.offlineAuditQueue.length === 0) {
      return 0;
    }

    const queue = [...localVaultCache.offlineAuditQueue];
    let flushedCount = 0;

    for (const item of queue) {
      try {
        await pool.query(
          `INSERT INTO staff_audit_logs (staff_id, clinic_id, action, ip_address, details, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            item.staffId,
            item.clinicId,
            item.action,
            item.ipAddress || null,
            JSON.stringify({ ...(item.details || {}), syncedFromOfflineVault: true }),
            item.status,
            item.timestamp,
          ]
        );
        flushedCount++;
      } catch (err) {
        // Stop flushing if DB becomes unreachable again
        break;
      }
    }

    // Remove flushed entries from queue
    localVaultCache.offlineAuditQueue = localVaultCache.offlineAuditQueue.slice(flushedCount);
    encryptAndSaveVault(localVaultCache);
    return flushedCount;
  },

  /**
   * Returns metadata about the local encrypted staff vault.
   */
  getVaultStats() {
    return {
      clinicsCached: Object.keys(localVaultCache.staffByClinic).length,
      totalStaffCached: Object.values(localVaultCache.staffByClinic).reduce((acc, l) => acc + l.length, 0),
      queuedAudits: localVaultCache.offlineAuditQueue.length,
    };
  },
};
