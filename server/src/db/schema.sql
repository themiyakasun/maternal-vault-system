-- MaternalVault Edge - PostgreSQL Schema

CREATE TABLE IF NOT EXISTS patients (
  id VARCHAR(16) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  initials VARCHAR(8),
  initials_color VARCHAR(64),
  age INTEGER NOT NULL,
  gravida INTEGER NOT NULL,
  para INTEGER NOT NULL,
  gestational_weeks INTEGER NOT NULL,
  gestational_days INTEGER NOT NULL DEFAULT 0,
  trimester INTEGER NOT NULL,
  bp_systolic INTEGER NOT NULL,
  bp_diastolic INTEGER NOT NULL,
  is_bp_alert BOOLEAN DEFAULT FALSE,
  bmi NUMERIC(4,1) NOT NULL,
  bmi_category VARCHAR(64),
  bmi_status_class VARCHAR(32),
  risk_tier VARCHAR(16) NOT NULL,
  risk_title VARCHAR(64) NOT NULL,
  risk_subtitle VARCHAR(128),
  preterm_probability INTEGER NOT NULL,
  alert_headline VARCHAR(128),
  alert_details TEXT,
  feature_weights JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  village VARCHAR(128),
  locality VARCHAR(128),
  abha_id VARCHAR(32),
  edd VARCHAR(32),
  fundal_height VARCHAR(32),
  is_fundal_alert BOOLEAN DEFAULT FALSE,
  hb NUMERIC(3,1),
  is_hb_alert BOOLEAN DEFAULT FALSE,
  fhr VARCHAR(32),
  is_fhr_alert BOOLEAN DEFAULT FALSE,
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

CREATE INDEX IF NOT EXISTS idx_patients_risk_tier ON patients(risk_tier);
CREATE INDEX IF NOT EXISTS idx_patients_trimester ON patients(trimester);
CREATE INDEX IF NOT EXISTS idx_patients_sync_status ON patients(sync_status);
CREATE INDEX IF NOT EXISTS idx_patients_village ON patients(village);
