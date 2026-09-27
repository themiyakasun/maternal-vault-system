import crypto from 'crypto';
import { pool, generateSalt, hashPassword, hashPin } from './index.js';
import { localStaffVault } from './localStaffVault.js';
import type { Clinic, StaffUser, LoginResponse, OfflineSession } from '../types/auth.js';

// Station Secret for offline token signing
const TOKEN_SECRET = process.env.OFFLINE_TOKEN_SECRET || 'MATERNA_VAULT_OFFLINE_STATION_HMAC_SECRET_9876';

export { generateSalt, hashPassword, hashPin };

// Pre-seeded Multi-Clinic Hierarchy (Fallback metadata)
const defaultClinicsMetadata: Omit<Clinic, 'staff'>[] = [
  {
    id: 'clinic-4b-rampur',
    code: 'PHP-4B',
    name: 'Primary Health Post 4B',
    division: 'Rampur Division',
    district: 'Rampur District',
    mohArea: 'MOH Rampur Central',
    stationKey: 'MATERNA_VAULT_SECURE_PHM_MUM_71_SECRET_KEY',
    activeMothersCount: 142,
  },
  {
    id: 'clinic-02-kandy',
    code: 'SC-KND-02',
    name: 'Sub-Center Kandy Rural',
    division: 'Kandy Division',
    district: 'Kandy District',
    mohArea: 'MOH Kandy North',
    stationKey: 'MATERNA_VAULT_SECURE_KANDY_STATION_KEY',
    activeMothersCount: 86,
  },
];

async function recordAuditLog(
  staffId: string,
  clinicId: string,
  action: string,
  status: 'success' | 'failed_password' | 'failed_pin' | 'failed_inactive' | 'failed_not_found' | 'error',
  ipAddress?: string,
  details?: any
) {
  try {
    await pool.query(
      `INSERT INTO staff_audit_logs (staff_id, clinic_id, action, ip_address, details, status)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [staffId, clinicId, action, ipAddress || null, JSON.stringify(details || {}), status]
    );
  } catch (err) {
    // If PostgreSQL is unreachable, queue in the local encrypted staff vault
    localStaffVault.recordOfflineAudit({
      staffId,
      clinicId,
      action,
      status,
      ipAddress,
      details,
    });
  }
}

export interface CreateStaffInput {
  id?: string;
  name: string;
  title: string;
  role: 'phm_lead' | 'phm' | 'doctor' | 'nurse' | 'admin';
  clinicId: string;
  password: string;
  avatarUrl?: string;
  assignedBeats?: string[];
}

class TenantStore {
  /**
   * List all clinics (without exposing passwords, hashes, and salts)
   */
  public async getClinics(): Promise<Omit<Clinic, 'staff'>[]> {
    try {
      const res = await pool.query(`
        SELECT id, code, name, division, district, 
               moh_area as "mohArea", station_key as "stationKey", 
               active_mothers_count as "activeMothersCount"
        FROM tenants 
        ORDER BY name ASC
      `);

      if (res.rows.length > 0) {
        return res.rows;
      }
    } catch (err) {
      console.warn('⚠️  Failed to fetch tenants from PostgreSQL, falling back to cached seed:', (err as Error).message);
    }

    return defaultClinicsMetadata;
  }

  /**
   * Get clinic by ID
   */
  public async getClinicById(clinicId: string): Promise<Clinic | undefined> {
    let tenantInfo: Omit<Clinic, 'staff'> | undefined;

    try {
      const tenantRes = await pool.query(
        `SELECT id, code, name, division, district, 
                moh_area as "mohArea", station_key as "stationKey", 
                active_mothers_count as "activeMothersCount"
         FROM tenants 
         WHERE id = $1`,
        [clinicId]
      );

      if (tenantRes.rows.length > 0) {
        tenantInfo = tenantRes.rows[0];
      }
    } catch (err) {
      console.warn(`⚠️  Failed to fetch clinic ${clinicId} from PostgreSQL, falling back to cache`);
    }

    if (!tenantInfo) {
      tenantInfo = defaultClinicsMetadata.find((c) => c.id === clinicId);
    }

    if (!tenantInfo) return undefined;

    const staff = await this.getStaffForClinic(clinicId);
    return {
      ...tenantInfo,
      staff: staff as any,
    };
  }

  /**
   * Get list of staff users for a specific clinic (safe representation, strictly clinic-scoped).
   * Synchronizes from PostgreSQL to local encrypted staff vault when online.
   */
  public async getStaffForClinic(clinicId: string): Promise<Omit<StaffUser, 'passwordHash' | 'pinHash' | 'salt'>[]> {
    try {
      const res = await pool.query(
        `SELECT id, name, title, role, clinic_id as "clinicId", 
                clinic_name as "clinicName", avatar_url as "avatarUrl", 
                initials, salt, password_hash as "passwordHash", pin_hash as "pinHash",
                is_active as "isActive", assigned_beats as "assignedBeats"
         FROM staff_users 
         WHERE clinic_id = $1 AND is_active = TRUE
         ORDER BY name ASC`,
        [clinicId]
      );

      if (res.rows.length > 0) {
        // Save full credentials to local encrypted staff vault for offline resilience
        localStaffVault.saveStaffForClinic(clinicId, res.rows);

        // Return safe version without passwordHash or salt
        return res.rows.map(({ passwordHash, pinHash, salt, ...safeUser }) => safeUser);
      }
    } catch (err) {
      console.warn(`⚠️  Failed to fetch staff for clinic ${clinicId} from PostgreSQL, querying Local Encrypted Staff Vault:`, (err as Error).message);
    }

    // Offline Fallback: Read from Local Encrypted Staff Vault
    const cachedStaff = localStaffVault.getStaffForClinic(clinicId);
    return cachedStaff
      .filter((s) => s.isActive)
      .map(({ passwordHash, pinHash, salt, ...safeUser }) => safeUser);
  }

  /**
   * Get single safe staff user by ID within a clinic
   */
  public async getStaffUserById(clinicId: string, staffId: string): Promise<Omit<StaffUser, 'passwordHash' | 'pinHash' | 'salt'> | undefined> {
    const staffList = await this.getStaffForClinic(clinicId);
    return staffList.find((s) => s.id === staffId);
  }

  /**
   * Dynamically register/create a new staff member with on-the-fly random salt generation.
   */
  public async createStaffMember(input: CreateStaffInput): Promise<{ success: boolean; message: string; staff?: Omit<StaffUser, 'passwordHash' | 'pinHash' | 'salt'> }> {
    const { name, title, role, clinicId, password, avatarUrl, assignedBeats } = input;

    if (!name || !title || !role || !clinicId || !password) {
      return { success: false, message: 'All fields including name, title, role, clinicId, and password are required.' };
    }

    // Dynamic 128-bit random hex salt
    const salt = generateSalt();
    const passwordHash = hashPassword(password, salt);
    const pinHash = hashPin(password.slice(0, 4), salt);

    const initials = name
      .split(' ')
      .map((part) => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 4);

    const clinic = await this.getClinicById(clinicId);
    const clinicName = clinic?.name || 'Clinic Station';

    const staffId = input.id || `STF-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    const newStaff: StaffUser = {
      id: staffId,
      name,
      title,
      role,
      clinicId,
      clinicName,
      avatarUrl: avatarUrl || 'https://images.unsplash.com/photo-1594824813501-4835002b1f3c?w=120&auto=format&fit=crop&q=80',
      initials,
      salt,
      passwordHash,
      pinHash,
      isActive: true,
      assignedBeats: assignedBeats || [],
    };

    // 1. Try saving to PostgreSQL
    try {
      await pool.query(
        `INSERT INTO staff_users (id, name, title, role, clinic_id, clinic_name, avatar_url, initials, salt, password_hash, pin_hash, is_active, assigned_beats)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
         ON CONFLICT (id) DO UPDATE SET
           name = EXCLUDED.name,
           title = EXCLUDED.title,
           role = EXCLUDED.role,
           avatar_url = EXCLUDED.avatar_url,
           salt = EXCLUDED.salt,
           password_hash = EXCLUDED.password_hash,
           pin_hash = EXCLUDED.pin_hash,
           is_active = EXCLUDED.is_active,
           assigned_beats = EXCLUDED.assigned_beats,
           updated_at = NOW()`,
        [
          newStaff.id,
          newStaff.name,
          newStaff.title,
          newStaff.role,
          newStaff.clinicId,
          newStaff.clinicName,
          newStaff.avatarUrl,
          newStaff.initials,
          newStaff.salt,
          newStaff.passwordHash,
          newStaff.pinHash,
          newStaff.isActive,
          JSON.stringify(newStaff.assignedBeats || []),
        ]
      );
    } catch (err) {
      console.warn('⚠️  PostgreSQL unreachable during staff registration, saving to local encrypted staff vault:', (err as Error).message);
    }

    // 2. Always persist to Local Encrypted Staff Vault for immediate offline login capability
    localStaffVault.upsertStaffUser(newStaff);

    const { passwordHash: _p, pinHash: _pin, salt: _s, ...safeStaff } = newStaff;
    return {
      success: true,
      message: `Staff member ${name} created successfully.`,
      staff: safeStaff,
    };
  }

  /**
   * Dual-Mode Authentication: Authenticates staff user using dynamic PBKDF2-SHA512 password verification.
   * Checks PostgreSQL Central DB first, and seamlessly falls back to Local Encrypted Staff Vault when offline.
   */
  public async authenticateStaff(
    clinicId: string, 
    staffId: string, 
    passwordOrPin: string, 
    ipAddress?: string
  ): Promise<LoginResponse> {
    let staffMember: StaffUser | null = null;
    let clinic: Omit<Clinic, 'staff'> | null = null;
    let isOfflineMode = false;

    if (!passwordOrPin) {
      return { success: false, message: 'Password is required to sign in.' };
    }

    // 1. Try PostgreSQL Central DB
    try {
      const res = await pool.query(
        `SELECT s.id, s.name, s.title, s.role, s.clinic_id as "clinicId", 
                s.clinic_name as "clinicName", s.avatar_url as "avatarUrl", 
                s.initials, s.salt, s.password_hash as "passwordHash", s.pin_hash as "pinHash", 
                s.is_active as "isActive", s.assigned_beats as "assignedBeats",
                t.code as "clinicCode", t.name as "clinicFullName", t.division, 
                t.district, t.moh_area as "mohArea", t.station_key as "stationKey", 
                t.active_mothers_count as "activeMothersCount"
         FROM staff_users s
         JOIN tenants t ON s.clinic_id = t.id
         WHERE s.id = $1 AND s.clinic_id = $2`,
        [staffId, clinicId]
      );

      if (res.rows.length > 0) {
        const row = res.rows[0];
        staffMember = {
          id: row.id,
          name: row.name,
          title: row.title,
          role: row.role,
          clinicId: row.clinicId,
          clinicName: row.clinicName,
          avatarUrl: row.avatarUrl,
          initials: row.initials,
          salt: row.salt,
          passwordHash: row.passwordHash,
          pinHash: row.pinHash,
          isActive: row.isActive,
          assignedBeats: row.assignedBeats,
        };
        clinic = {
          id: clinicId,
          code: row.clinicCode,
          name: row.clinicFullName,
          division: row.division,
          district: row.district,
          mohArea: row.mohArea,
          stationKey: row.stationKey,
          activeMothersCount: row.activeMothersCount,
        };

        // Cache into local staff vault on successful fetch
        localStaffVault.upsertStaffUser(staffMember);

        // Attempt flushing any pending offline audit logs
        localStaffVault.flushOfflineAuditsToPostgres(pool).catch(() => {});
      }
    } catch (err) {
      console.warn('⚠️  PostgreSQL lookup failed during authentication, falling back to Local Encrypted Staff Vault:', (err as Error).message);
      isOfflineMode = true;
    }

    // 2. Offline Fallback to Local Encrypted Staff Vault if DB is unreachable or returned no rows
    if (!staffMember || !clinic) {
      clinic = defaultClinicsMetadata.find((c) => c.id === clinicId) || null;
      if (!clinic) {
        await recordAuditLog(staffId, clinicId, 'login_password', 'failed_not_found', ipAddress, { reason: 'Clinic not found' });
        return { success: false, message: 'Clinic station not recognized.' };
      }

      staffMember = localStaffVault.findStaffUser(clinicId, staffId);
      if (!staffMember) {
        await recordAuditLog(staffId, clinicId, 'login_password', 'failed_not_found', ipAddress, { reason: 'Staff member not found in clinic' });
        return { success: false, message: 'Staff member not found at this clinic.' };
      }
      isOfflineMode = true;
    }

    if (!staffMember.isActive) {
      await recordAuditLog(staffId, clinicId, 'login_password', 'failed_inactive', ipAddress, { reason: 'Account inactive' });
      return { success: false, message: 'This staff account has been deactivated.' };
    }

    // High-security dynamic password verification using the user's stored salt
    const inputPasswordHash = hashPassword(passwordOrPin, staffMember.salt);
    const inputPinHash = hashPin(passwordOrPin, staffMember.salt);

    const isPasswordValid = 
      (staffMember.passwordHash && staffMember.passwordHash === inputPasswordHash) ||
      (staffMember.pinHash && staffMember.pinHash === inputPinHash);

    if (!isPasswordValid) {
      await recordAuditLog(staffId, clinicId, 'login_password', 'failed_password', ipAddress, { 
        reason: 'Incorrect password',
        mode: isOfflineMode ? 'offline_vault' : 'central_db'
      });
      return { success: false, message: 'Incorrect password. Please try again.' };
    }

    // Record successful login audit log
    await recordAuditLog(staffId, clinicId, 'login_password', 'success', ipAddress, {
      staffName: staffMember.name,
      role: staffMember.role,
      clinicName: clinic.name,
      authMethod: 'PBKDF2-SHA512 Password',
      mode: isOfflineMode ? 'offline_vault' : 'central_db',
    });

    // Generate signed Shift Session Token (Valid for 12 hours)
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    const sessionPayload: OfflineSession = {
      token: '',
      userId: staffMember.id,
      clinicId: clinic.id,
      issuedAt,
      expiresAt,
    };

    const payloadString = `${sessionPayload.userId}:${sessionPayload.clinicId}:${sessionPayload.issuedAt}:${sessionPayload.expiresAt}`;
    const signature = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadString).digest('hex');
    const token = Buffer.from(JSON.stringify({ ...sessionPayload, sig: signature })).toString('base64url');

    const { passwordHash, pinHash, salt, ...safeUser } = staffMember;

    return {
      success: true,
      message: isOfflineMode 
        ? `Welcome back, ${staffMember.name} (Offline Station Mode)` 
        : `Welcome back, ${staffMember.name}`,
      token,
      expiresAt,
      user: safeUser,
      clinic,
    };
  }

  /**
   * Verify an offline session token
   */
  public verifyToken(tokenString: string): { valid: boolean; session?: OfflineSession; error?: string } {
    try {
      const decoded = JSON.parse(Buffer.from(tokenString, 'base64url').toString('utf8'));
      if (!decoded.userId || !decoded.clinicId || !decoded.expiresAt || !decoded.sig) {
        return { valid: false, error: 'Malformed token.' };
      }

      if (new Date(decoded.expiresAt) < new Date()) {
        return { valid: false, error: 'Session expired. Please re-enter your password.' };
      }

      const payloadString = `${decoded.userId}:${decoded.clinicId}:${decoded.issuedAt}:${decoded.expiresAt}`;
      const expectedSig = crypto.createHmac('sha256', TOKEN_SECRET).update(payloadString).digest('hex');

      if (expectedSig !== decoded.sig) {
        return { valid: false, error: 'Invalid token signature.' };
      }

      return {
        valid: true,
        session: {
          token: tokenString,
          userId: decoded.userId,
          clinicId: decoded.clinicId,
          issuedAt: decoded.issuedAt,
          expiresAt: decoded.expiresAt,
        },
      };
    } catch {
      return { valid: false, error: 'Could not decode session token.' };
    }
  }
}

export const tenantStore = new TenantStore();
