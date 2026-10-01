import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type { Patient, ANCVisit, ANCVisitInput } from '../types/patient.js';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'maternal_vault_encrypted.db');
const STATION_KEY = process.env.STATION_MASTER_KEY || 'MATERNA_VAULT_SECURE_PHM_MUM_71_SECRET_KEY';
const ALGORITHM = 'aes-256-gcm';

interface EncryptedPayload {
  version: number;
  cipher: string;
  iv: string;
  authTag: string;
  salt: string;
  checksum: string;
  encryptedAt: string;
  recordCount: number;
  encryptedData: string;
}

// Initial clinical seed data (Empty for fresh manual entry)
const initialSeedPatients: Patient[] = [];

// In-Memory RAM Cache of the Decrypted Database
let localPatientsCache: Patient[] = [];
let pendingDeletions: Array<{ id: string; tenantId?: string }> = [];
let dbRevision = 1;
let dbMeta = {
  encryptedAt: new Date().toISOString(),
  checksum: '',
  cipher: ALGORITHM,
  fileSize: 0,
};

// Derive cryptographic key from station master key
function deriveKey(salt: Buffer): Buffer {
  return crypto.pbkdf2Sync(STATION_KEY, salt, 100000, 32, 'sha512');
}

// Encrypt payload to disk
function encryptAndSave(patients: Patient[]): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    const jsonString = JSON.stringify(patients);
    const salt = crypto.randomBytes(16);
    const key = deriveKey(salt);
    const iv = crypto.randomBytes(12);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    let encrypted = cipher.update(jsonString, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    const checksum = crypto.createHash('sha256').update(jsonString).digest('hex');

    const payload: EncryptedPayload = {
      version: 1,
      cipher: ALGORITHM,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      salt: salt.toString('hex'),
      checksum,
      encryptedAt: new Date().toISOString(),
      recordCount: patients.length,
      encryptedData: encrypted,
    };

    fs.writeFileSync(DB_FILE, JSON.stringify(payload, null, 2), 'utf8');

    const stats = fs.statSync(DB_FILE);
    dbMeta = {
      encryptedAt: payload.encryptedAt,
      checksum: payload.checksum,
      cipher: ALGORITHM,
      fileSize: stats.size,
    };
  } catch (err) {
    console.error('Failed to save encrypted database:', err);
  }
}

// Decrypt database from disk
function decryptAndLoad(): Patient[] {
  try {
    if (!fs.existsSync(DB_FILE)) {
      console.log('📦 No encrypted local database found. Creating fresh empty encrypted store...');
      encryptAndSave(initialSeedPatients);
      return [...initialSeedPatients];
    }

    const raw = fs.readFileSync(DB_FILE, 'utf8');
    const payload: EncryptedPayload = JSON.parse(raw);

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
      throw new Error('Local database integrity violation: checksum mismatch');
    }

    const stats = fs.statSync(DB_FILE);
    dbMeta = {
      encryptedAt: payload.encryptedAt,
      checksum: payload.checksum,
      cipher: payload.cipher,
      fileSize: stats.size,
    };

    const patients: Patient[] = JSON.parse(decrypted);
    for (const p of patients) {
      if (!p.tenantId) {
        p.tenantId = p.clinicId || 'clinic-4b-rampur';
      }
      if (!p.clinicId) {
        p.clinicId = p.tenantId || 'clinic-4b-rampur';
      }
    }
    return patients;
  } catch (err) {
    console.warn('⚠️  Could not decrypt existing local database (station key changed or fresh deployment). Initializing fresh store.');
    encryptAndSave(initialSeedPatients);
    return [...initialSeedPatients];
  }
}

export const localEncryptedDb = {
  // Initialize Database on server startup
  init() {
    localPatientsCache = decryptAndLoad();
    console.log(`🔒 Local Encrypted Database loaded. [${localPatientsCache.length} records • AES-256-GCM encrypted • ${dbMeta.fileSize} bytes]`);
  },

  // Get all patients with filtering
  getAll(params?: {
    search?: string;
    risk?: string;
    trimester?: string;
    sync?: string;
    condition?: string;
    tenantId?: string;
    limit?: number;
    offset?: number;
  } | string) {
    const opts = typeof params === 'string' ? { tenantId: params } : (params || {});
    let filtered = [...localPatientsCache];

    // Multi-tenant isolation filter
    if (opts.tenantId && opts.tenantId !== 'all') {
      filtered = filtered.filter(p => {
        const pTenant = p.tenantId || p.clinicId;
        return pTenant === opts.tenantId;
      });
    }

    if (opts.search) {
      const q = opts.search.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.name.toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.abhaId && p.abhaId.toLowerCase().includes(q)) ||
          (p.locality && p.locality.toLowerCase().includes(q)) ||
          (p.village && p.village.toLowerCase().includes(q))
      );
    }

    if (opts.risk && opts.risk !== 'all') {
      filtered = filtered.filter(p => p.riskTier === opts.risk);
    }

    if (opts.trimester && opts.trimester !== 'all') {
      filtered = filtered.filter(p => p.trimester.toString() === opts.trimester);
    }

    if (opts.sync && opts.sync !== 'all') {
      filtered = filtered.filter(p => p.syncStatus === opts.sync);
    }

    if (opts.condition && opts.condition !== 'all') {
      filtered = filtered.filter(p => p.specificCondition === opts.condition);
    }

    filtered.sort((a, b) => {
      const rank = { high: 1, moderate: 2, low: 3 };
      return rank[a.riskTier] - rank[b.riskTier];
    });

    const offset = opts.offset ?? 0;
    const limit = opts.limit ?? 50;
    const paginated = filtered.slice(offset, offset + limit);

    return {
      total: filtered.length,
      data: paginated,
    };
  },

  // Get single patient by ID
  getById(id: string): Patient | undefined {
    return localPatientsCache.find(p => p.id === id);
  },

  // Get single patient by NIC number (case-insensitive & trimmed)
  getByNic(nic: string, _tenantId?: string): Patient | undefined {
    if (!nic) return undefined;
    const clean = nic.trim().toUpperCase();
    if (!clean) return undefined;
    return localPatientsCache.find(p => {
      if (!p.nicNo) return false;
      return p.nicNo.trim().toUpperCase() === clean;
    });
  },

  // Insert or upsert a patient
  insert(patient: Patient): Patient {
    const stampedPatient: Patient = {
      ...patient,
      tenantId: patient.tenantId || patient.clinicId || 'clinic-4b-rampur',
      clinicId: patient.clinicId || patient.tenantId || 'clinic-4b-rampur',
    };
    const existingIdx = localPatientsCache.findIndex(p => p.id === stampedPatient.id);
    if (existingIdx !== -1) {
      localPatientsCache[existingIdx] = {
        ...localPatientsCache[existingIdx],
        ...stampedPatient,
        updatedAt: stampedPatient.updatedAt || new Date().toISOString(),
      };
    } else {
      localPatientsCache.unshift(stampedPatient);
    }
    dbRevision++;
    encryptAndSave(localPatientsCache);
    return stampedPatient;
  },

  // Update existing patient
  update(id: string, updates: Partial<Patient>): Patient | undefined {
    const idx = localPatientsCache.findIndex(p => p.id === id);
    if (idx === -1) return undefined;

    const updated: Patient = {
      ...localPatientsCache[idx],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    localPatientsCache[idx] = updated;
    dbRevision++;
    encryptAndSave(localPatientsCache);
    return updated;
  },

  // Add Antenatal Clinic (ANC) Visit to patient record
  addClinicVisit(id: string, visitInput: ANCVisitInput): { patient: Patient; visit: ANCVisit } | null {
    const idx = localPatientsCache.findIndex(p => p.id === id);
    if (idx === -1) return null;

    const current = localPatientsCache[idx];
    const existingVisits = current.ancVisits || [];
    const visitNo = existingVisits.length + 1;

    const dateStr = visitInput.date || new Date().toISOString().split('T')[0];
    const poaStr = visitInput.poa || (visitInput.gestationalWeeks 
      ? `${visitInput.gestationalWeeks}w ${visitInput.gestationalDays ?? 0}d` 
      : `${current.gestationalWeeks}w ${current.gestationalDays}d`);

    const bpStr = visitInput.bp || `${visitInput.bpSystolic}/${visitInput.bpDiastolic}`;

    const newVisit: ANCVisit = {
      visitNo,
      date: dateStr,
      poa: poaStr,
      weightKg: visitInput.weightKg,
      bp: bpStr,
      sfhCm: visitInput.sfhCm || `${current.gestationalWeeks} cm`,
      presentation: visitInput.presentation || 'Cephalic',
      engagement: visitInput.engagement || (visitInput.gestationalWeeks && visitInput.gestationalWeeks > 36 ? 'Engaged' : 'Not engaged'),
      fhr: visitInput.fhr || current.fhr || '140 bpm',
      fm: visitInput.fm || 'Active (>10/12h)',
      urineAlb: visitInput.urineAlb || 'Nil',
      urineSug: visitInput.urineSug || 'Nil',
      edema: visitInput.edema || 'Nil',
      examiner: visitInput.examiner || current.assessedBy || 'Priya Sharma, PHM',
      remarks: visitInput.remarks || 'Routine antenatal clinic visit recorded.',
      supplements: {
        ifaIssued: visitInput.ifaIssued ?? true,
        calciumIssued: visitInput.calciumIssued ?? true,
        vitCIssued: visitInput.vitCIssued ?? true,
        foodSupplement: visitInput.foodSupplement ?? true,
      },
    };

    // Calculate updated weeks & trimester if passed
    const newWeeks = visitInput.gestationalWeeks ?? current.gestationalWeeks;
    const newDays = visitInput.gestationalDays ?? current.gestationalDays;
    const newTrimester = (newWeeks > 27 ? 3 : newWeeks > 13 ? 2 : 1) as 1 | 2 | 3;

    // Recalculate BMI if height is known
    let newBmi = current.bmi;
    let newBmiCategory = current.bmiCategory;
    let newBmiStatusClass = current.bmiStatusClass;
    if (current.heightCm && current.heightCm > 0) {
      newBmi = +(visitInput.weightKg / Math.pow(current.heightCm / 100, 2)).toFixed(1);
      newBmiCategory =
        newBmi >= 30
          ? 'Elevated (Obese I)'
          : newBmi >= 25
          ? 'Overweight'
          : newBmi < 18.5
          ? 'Underweight Range'
          : 'Normal';
      newBmiStatusClass = newBmi >= 30 ? 'danger' : newBmi >= 25 ? 'warning' : 'normal';
    }

    const updatedPatient: Patient = {
      ...current,
      gestationalWeeks: newWeeks,
      gestationalDays: newDays,
      trimester: newTrimester,
      weightKg: visitInput.weightKg,
      bpSystolic: visitInput.bpSystolic,
      bpDiastolic: visitInput.bpDiastolic,
      isBpAlert: visitInput.bpSystolic >= 140 || visitInput.bpDiastolic >= 90,
      fundalHeight: visitInput.sfhCm || current.fundalHeight,
      fhr: visitInput.fhr || current.fhr,
      bmi: newBmi,
      bmiCategory: newBmiCategory,
      bmiStatusClass: newBmiStatusClass,
      assessedBy: newVisit.examiner,
      assessedTime: 'Just now (Visit #' + visitNo + ')',
      notes: visitInput.remarks || current.notes,
      syncStatus: 'updated-local',
      ancVisits: [...existingVisits, newVisit],
      updatedAt: new Date().toISOString(),
    };

    localPatientsCache[idx] = updatedPatient;
    dbRevision++;
    encryptAndSave(localPatientsCache);

    return { patient: updatedPatient, visit: newVisit };
  },

  // Delete patient
  delete(id: string): boolean {
    const idx = localPatientsCache.findIndex(p => p.id === id);
    if (idx === -1) return false;

    const patient = localPatientsCache[idx];
    pendingDeletions.push({
      id: patient.id,
      tenantId: patient.tenantId || patient.clinicId,
    });

    localPatientsCache.splice(idx, 1);
    dbRevision++;
    encryptAndSave(localPatientsCache);
    return true;
  },

  // Reconcile patient upserted from remote PostgreSQL (downstream sync)
  upsertFromRemote(remotePatient: Patient): boolean {
    const idx = localPatientsCache.findIndex(p => p.id === remotePatient.id);
    const normalized: Patient = {
      ...remotePatient,
      syncStatus: 'synced-p2p',
      syncNode: 'Central PostgreSQL',
      syncProtocol: 'PostgreSQL Real-Time Synchronized',
    };

    if (idx === -1) {
      localPatientsCache.unshift(normalized);
      dbRevision++;
      encryptAndSave(localPatientsCache);
      return true;
    }

    const local = localPatientsCache[idx];
    // If local has offline changes, don't overwrite unless remote is newer
    if (local.syncStatus === 'updated-local') {
      const localTime = new Date(local.updatedAt || 0).getTime();
      const remoteTime = new Date(remotePatient.updatedAt || 0).getTime();
      if (remoteTime <= localTime) {
        return false; // Keep local unpushed change
      }
    }

    localPatientsCache[idx] = normalized;
    dbRevision++;
    encryptAndSave(localPatientsCache);
    return true;
  },

  // Delete patient removed from remote PostgreSQL (downstream deletion)
  deleteFromRemote(id: string): boolean {
    const idx = localPatientsCache.findIndex(p => p.id === id);
    if (idx === -1) return false;

    localPatientsCache.splice(idx, 1);
    dbRevision++;
    encryptAndSave(localPatientsCache);
    return true;
  },

  // Get current DB revision counter
  getRevision(): number {
    return dbRevision;
  },

  // Get pending deletions for PostgreSQL sync
  getPendingDeletions(): Array<{ id: string; tenantId?: string }> {
    return [...pendingDeletions];
  },

  // Clear pending deletion after successful push to PostgreSQL
  clearPendingDeletion(id: string): void {
    pendingDeletions = pendingDeletions.filter(d => d.id !== id);
  },

  // Clear all data (reset for fresh manual entry)
  clearAll(): void {
    localPatientsCache = [];
    pendingDeletions = [];
    dbRevision++;
    encryptAndSave(localPatientsCache);
  },

  // Get all records that need sync to central PostgreSQL
  getPendingSync(): Patient[] {
    return localPatientsCache.filter(
      p => p.syncStatus === 'pending-mesh' || p.syncStatus === 'updated-local'
    );
  },

  // Mark record as synced to central/mesh
  markSynced(id: string, syncNode = 'Central PostgreSQL', syncProtocol = 'HTTPS TLS 1.3 / Mesh Direct'): boolean {
    const idx = localPatientsCache.findIndex(p => p.id === id);
    if (idx === -1) return false;

    localPatientsCache[idx] = {
      ...localPatientsCache[idx],
      syncStatus: 'synced-p2p',
      syncNode,
      syncProtocol,
      assessedTime: 'Just now (Synced)',
    };
    encryptAndSave(localPatientsCache);
    return true;
  },

  // Get summary statistics (strictly scoped by tenant if provided)
  getStats(tenantId?: string) {
    let list = [...localPatientsCache];
    if (tenantId && tenantId !== 'all') {
      list = list.filter(p => {
        const pTenant = p.tenantId || p.clinicId;
        return !pTenant || pTenant === tenantId;
      });
    }

    const total = list.length;
    const synced = list.filter(p => p.syncStatus === 'synced-p2p').length;
    const pending = total - synced;

    return {
      totalRegistered: total,
      firstTrimester: list.filter(p => p.trimester === 1).length,
      secondTrimester: list.filter(p => p.trimester === 2).length,
      thirdTrimester: list.filter(p => p.trimester === 3).length,
      highRiskCount: list.filter(p => p.riskTier === 'high').length,
      moderateRiskCount: list.filter(p => p.riskTier === 'moderate').length,
      lowRiskCount: list.filter(p => p.riskTier === 'low').length,
      p2pSyncedCount: synced,
      pendingSyncCount: pending,
      syncedPercentage: total > 0 ? ((synced / total) * 100).toFixed(1) + '%' : '0.0%',
      tenantId: tenantId || 'all',
    };
  },

  // Get local database encryption and health telemetry
  getEncryptionMeta() {
    return {
      cipher: dbMeta.cipher,
      dbPath: DB_FILE,
      fileSize: dbMeta.fileSize,
      checksum: dbMeta.checksum,
      lastEncrypted: dbMeta.encryptedAt,
      isEncrypted: true,
      recordsInMemory: localPatientsCache.length,
    };
  },
};
