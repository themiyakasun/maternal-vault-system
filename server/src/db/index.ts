import pg from 'pg';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

const { Pool } = pg;

const isLocalDb =
  !process.env.DATABASE_URL ||
  process.env.DATABASE_URL.includes('localhost') ||
  process.env.DATABASE_URL.includes('127.0.0.1') ||
  process.env.DATABASE_URL.includes('@postgres') ||
  process.env.DATABASE_URL.includes('sslmode=disable') ||
  process.env.DATABASE_SSL === 'false';

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://postgres:postgres@localhost:5432/maternal_vault',
  ssl:
    process.env.NODE_ENV === 'production' && !isLocalDb
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

    // 5. Query and sync tenants and staff from cloud PostgreSQL into local encrypted vault
    client.release();
    try {
      const { tenantStore } = await import('./tenantStore.js');
      const loadedTenants = await tenantStore.getClinics();
      console.log(`✓ Synchronized ${loadedTenants.length} clinic tenant(s) and staff credentials from cloud DB.`);
    } catch (syncErr) {
      console.warn('Could not sync initial tenants from cloud DB:', (syncErr as Error).message);
    }
  } catch (err) {
    console.warn(
      '⚠️  PostgreSQL connection not established. Operating in resilient In-Memory RAM DB fallback mode.',
      (err as Error).message,
    );
    isDatabaseConnected = false;
  }
}

