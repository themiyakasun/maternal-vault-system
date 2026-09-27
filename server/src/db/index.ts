import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const { Pool } = pg;

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/maternal_vault',
  ssl:
    process.env.NODE_ENV === 'production'
      ? { rejectUnauthorized: false }
      : false,
});

export let isDatabaseConnected = false;

/**
 * Generates a cryptographically secure 128-bit random hex salt on the fly.
 */
export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * High-Security Password Hashing using PBKDF2-SHA512 with 100,000 iterations.
 */
export function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password.trim(), salt, 100000, 64, 'sha512').toString('hex');
}

export function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin.trim(), salt, 10000, 32, 'sha256').toString('hex');
}

export async function initDatabase() {
  try {
    const client = await pool.connect();
    console.log('✓ PostgreSQL connected successfully.');
    isDatabaseConnected = true;

    // 1. Tenants (Clinics) Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(32) NOT NULL,
        name VARCHAR(128) NOT NULL,
        division VARCHAR(128) NOT NULL,
        district VARCHAR(128) NOT NULL,
        moh_area VARCHAR(128),
        station_key VARCHAR(128),
        active_mothers_count INTEGER DEFAULT 0,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 2. Staff Users Table (with High-Security password_hash)
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_users (
        id VARCHAR(64) PRIMARY KEY,
        name VARCHAR(128) NOT NULL,
        title VARCHAR(128) NOT NULL,
        role VARCHAR(64) NOT NULL,
        clinic_id VARCHAR(64) NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        clinic_name VARCHAR(128),
        avatar_url TEXT,
        initials VARCHAR(8),
        salt VARCHAR(64) NOT NULL,
        password_hash VARCHAR(256),
        pin_hash VARCHAR(128),
        is_active BOOLEAN DEFAULT TRUE,
        assigned_beats JSONB DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 3. Staff Audit & Login Logs Table
    await client.query(`
      CREATE TABLE IF NOT EXISTS staff_audit_logs (
        id SERIAL PRIMARY KEY,
        staff_id VARCHAR(64) NOT NULL,
        clinic_id VARCHAR(64) NOT NULL,
        action VARCHAR(64) NOT NULL,
        ip_address VARCHAR(64),
        details JSONB DEFAULT '{}'::jsonb,
        status VARCHAR(32) DEFAULT 'success',
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // 4. Patients Table with Tenant Relation
    await client.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id VARCHAR(32) PRIMARY KEY,
        tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE SET NULL,
        name VARCHAR(128) NOT NULL,
        initials VARCHAR(8),
        initials_color VARCHAR(64),
        age INTEGER NOT NULL,
        dob VARCHAR(32),
        phone VARCHAR(32),
        nic_no VARCHAR(32),
        gravida INTEGER NOT NULL DEFAULT 1,
        para INTEGER NOT NULL DEFAULT 0,
        living_children INTEGER DEFAULT 0,
        abortions INTEGER DEFAULT 0,
        gestational_weeks INTEGER NOT NULL,
        gestational_days INTEGER NOT NULL DEFAULT 0,
        trimester INTEGER NOT NULL,
        bp_systolic INTEGER NOT NULL,
        bp_diastolic INTEGER NOT NULL,
        is_bp_alert BOOLEAN DEFAULT FALSE,
        bmi NUMERIC(5,2) NOT NULL,
        bmi_category VARCHAR(64),
        bmi_status_class VARCHAR(32),
        risk_tier VARCHAR(16) NOT NULL,
        risk_title VARCHAR(64) NOT NULL,
        risk_subtitle VARCHAR(128),
        preterm_probability INTEGER NOT NULL,
        alert_headline VARCHAR(128),
        alert_details TEXT,
        feature_weights JSONB DEFAULT '[]'::jsonb,
        ml_risk_assessment JSONB,
        notes TEXT,
        village VARCHAR(128),
        locality VARCHAR(128),
        abha_id VARCHAR(32),
        blood_group VARCHAR(16),
        registration_date VARCHAR(32),
        edd VARCHAR(32),
        lmp VARCHAR(32),
        poa_at_booking VARCHAR(32),
        height_cm NUMERIC(5,1),
        weight_kg NUMERIC(5,1),
        partner_name VARCHAR(128),
        partner_age INTEGER,
        partner_occupation VARCHAR(128),
        moh_area VARCHAR(128),
        phm_register_no VARCHAR(64),
        fundal_height VARCHAR(32),
        is_fundal_alert BOOLEAN DEFAULT FALSE,
        hb NUMERIC(4,2),
        is_hb_alert BOOLEAN DEFAULT FALSE,
        fhr VARCHAR(32),
        is_fhr_alert BOOLEAN DEFAULT FALSE,
        intended_hospital VARCHAR(128),
        emergency_transport_ready BOOLEAN DEFAULT TRUE,
        medical_history JSONB DEFAULT '{}'::jsonb,
        lab_results JSONB DEFAULT '{}'::jsonb,
        immunization JSONB DEFAULT '{}'::jsonb,
        past_obstetric_history JSONB DEFAULT '[]'::jsonb,
        anc_visits JSONB DEFAULT '[]'::jsonb,
        sync_status VARCHAR(32) DEFAULT 'synced-p2p',
        sync_node VARCHAR(64),
        sync_protocol VARCHAR(64),
        assessed_by VARCHAR(128),
        assessed_time VARCHAR(64),
        assessed_location VARCHAR(128),
        specific_condition VARCHAR(128),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `);

    // Ensure columns exist if table previously existed with old schema
    const alterQueries = [
      `ALTER TABLE staff_users ADD COLUMN IF NOT EXISTS password_hash VARCHAR(256);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS tenant_id VARCHAR(64) REFERENCES tenants(id) ON DELETE SET NULL;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS dob VARCHAR(32);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS phone VARCHAR(32);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS nic_no VARCHAR(32);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS living_children INTEGER DEFAULT 0;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS abortions INTEGER DEFAULT 0;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS blood_group VARCHAR(16);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS registration_date VARCHAR(32);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS lmp VARCHAR(32);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS poa_at_booking VARCHAR(32);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS height_cm NUMERIC(5,1);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS weight_kg NUMERIC(5,1);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS partner_name VARCHAR(128);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS partner_age INTEGER;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS partner_occupation VARCHAR(128);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS moh_area VARCHAR(128);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS phm_register_no VARCHAR(64);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS intended_hospital VARCHAR(128);`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS emergency_transport_ready BOOLEAN DEFAULT TRUE;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_history JSONB DEFAULT '{}'::jsonb;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS lab_results JSONB DEFAULT '{}'::jsonb;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS immunization JSONB DEFAULT '{}'::jsonb;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS past_obstetric_history JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS anc_visits JSONB DEFAULT '[]'::jsonb;`,
      `ALTER TABLE patients ADD COLUMN IF NOT EXISTS ml_risk_assessment JSONB;`,
    ];

    for (const q of alterQueries) {
      try {
        await client.query(q);
      } catch {
        // column may already exist
      }
    }

    // 5. Seed default tenants & staff if empty or update passwords
    await seedDefaultTenantsAndStaff(client);

    client.release();
  } catch (err) {
    console.warn(
      '⚠️  PostgreSQL connection not established. Operating in resilient In-Memory RAM DB fallback mode.',
      (err as Error).message,
    );
    isDatabaseConnected = false;
  }
}

async function seedDefaultTenantsAndStaff(client: pg.PoolClient) {
  try {
    // Check if tenants exist
    const tenantsRes = await client.query('SELECT COUNT(*) FROM tenants');
    const count = parseInt(tenantsRes.rows[0].count, 10);

    if (count === 0) {
      console.log('🌱 Seeding initial clinics & staff into central PostgreSQL...');

      // Seed Clinic 1
      await client.query(`
        INSERT INTO tenants (id, code, name, division, district, moh_area, station_key, active_mothers_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING;
      `, [
        'clinic-4b-rampur',
        'PHP-4B',
        'Primary Health Post 4B',
        'Rampur Division',
        'Rampur District',
        'MOH Rampur Central',
        'MATERNA_VAULT_SECURE_PHM_MUM_71_SECRET_KEY',
        142,
      ]);

      // Seed Clinic 2
      await client.query(`
        INSERT INTO tenants (id, code, name, division, district, moh_area, station_key, active_mothers_count)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT (id) DO NOTHING;
      `, [
        'clinic-02-kandy',
        'SC-KND-02',
        'Sub-Center Kandy Rural',
        'Kandy Division',
        'Kandy District',
        'MOH Kandy North',
        'MATERNA_VAULT_SECURE_KANDY_STATION_KEY',
        86,
      ]);

      // Dynamic salts for initial seed accounts
      const priyaSalt = generateSalt();
      const sunitaSalt = generateSalt();
      const rajivSalt = generateSalt();
      const anjaliSalt = generateSalt();

      // Seed Staff for Clinic 1
      await client.query(`
        INSERT INTO staff_users (id, name, title, role, clinic_id, clinic_name, avatar_url, initials, salt, password_hash, pin_hash, is_active, assigned_beats)
        VALUES 
        ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13),
        ($14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26),
        ($27, $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39)
        ON CONFLICT (id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash;
      `, [
        // Priya
        'PHM-PRIYA-71', 'Sister Priya Sharma', 'Public Health Midwife (Lead)', 'phm_lead',
        'clinic-4b-rampur', 'Primary Health Post 4B',
        'https://images.unsplash.com/photo-1594824813501-4835002b1f3c?w=120&auto=format&fit=crop&q=80',
        'PS', priyaSalt, hashPassword('Priya@Materna2026!', priyaSalt), hashPin('1234', priyaSalt), true,
        JSON.stringify(['Rampur Sector 1', 'Rampur Sector 2', 'Rampur Sector 3']),
        
        // Sunita
        'PHM-SUNITA-02', 'Sister Sunita Bai', 'Public Health Midwife', 'phm',
        'clinic-4b-rampur', 'Primary Health Post 4B',
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=120&auto=format&fit=crop&q=80',
        'SB', sunitaSalt, hashPassword('Sunita@Care2026!', sunitaSalt), hashPin('5678', sunitaSalt), true,
        JSON.stringify(['Rampur Sector 4', 'Rampur Sector 5']),

        // Dr. Rajiv
        'DOC-RAJIV-01', 'Dr. Rajiv Sen', 'MOH Medical Officer', 'doctor',
        'clinic-4b-rampur', 'Primary Health Post 4B',
        'https://images.unsplash.com/photo-1622253692010-333f2da6031d?w=120&auto=format&fit=crop&q=80',
        'RS', rajivSalt, hashPassword('DrRajiv@MOH2026!', rajivSalt), hashPin('9900', rajivSalt), true,
        JSON.stringify([]),
      ]);

      // Seed Staff for Clinic 2
      await client.query(`
        INSERT INTO staff_users (id, name, title, role, clinic_id, clinic_name, avatar_url, initials, salt, password_hash, pin_hash, is_active, assigned_beats)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT (id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash;
      `, [
        'PHM-ANJALI-14', 'Sister Anjali Perera', 'Public Health Midwife (Lead)', 'phm_lead',
        'clinic-02-kandy', 'Sub-Center Kandy Rural',
        'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=120&auto=format&fit=crop&q=80',
        'AP', anjaliSalt, hashPassword('Anjali@Kandy2026!', anjaliSalt), hashPin('2468', anjaliSalt), true,
        JSON.stringify(['Kandy Sector 1', 'Kandy Sector 2']),
      ]);

      console.log('✓ Central PostgreSQL database successfully seeded with clinic tenants and staff users.');
    } else {
      // Ensure any existing staff members have dynamic salts & password hashes populated
      const staffRes = await client.query('SELECT id, salt, password_hash FROM staff_users');
      for (const row of staffRes.rows) {
        let userSalt = row.salt;
        if (!userSalt) {
          userSalt = generateSalt();
          await client.query('UPDATE staff_users SET salt = $1 WHERE id = $2', [userSalt, row.id]);
        }

        if (!row.password_hash) {
          let defaultPw = 'Priya@Materna2026!';
          if (row.id === 'PHM-SUNITA-02') defaultPw = 'Sunita@Care2026!';
          if (row.id === 'DOC-RAJIV-01') defaultPw = 'DrRajiv@MOH2026!';
          if (row.id === 'PHM-ANJALI-14') defaultPw = 'Anjali@Kandy2026!';
          await client.query(
            'UPDATE staff_users SET password_hash = $1 WHERE id = $2',
            [hashPassword(defaultPw, userSalt), row.id]
          );
        }
      }
    }
  } catch (err) {
    console.error('Failed to seed default tenants & staff in PostgreSQL:', err);
  }
}

