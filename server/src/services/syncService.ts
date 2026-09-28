import { pool } from '../db/index.js';
import { localEncryptedDb } from '../db/localEncryptedDb.js';
import { tenantStore } from '../db/tenantStore.js';
import type { Patient } from '../types/patient.js';

export interface CentralDbStatus {
  online: boolean;
  latencyMs: number | null;
  host: string | null;
  database: string | null;
  port: number | null;
  serverVersion: string | null;
  postgresTotalPatients: number;
  postgresTenantPatients: number;
  postgresTenantsCount: number;
  localTotalRecords: number;
  localPendingRecords: number;
  localSyncedRecords: number;
  activeClinicId: string | null;
  lastSyncAttempt: string | null;
  lastSuccessfulSync: string | null;
  checkedAt: string;
  error?: string;
}

export interface SyncTelemetry {
  isPostgresOnline: boolean;
  pendingRecordsCount: number;
  lastSyncAttempt: string | null;
  lastSuccessfulSync: string | null;
  syncMode: 'Local Encrypted Primary' | 'PostgreSQL Synchronized';
  autoSyncEnabled: boolean;
}

let lastSyncAttempt: string | null = null;
let lastSuccessfulSync: string | null = null;
let isPostgresOnline = false;
let syncWorkerTimer: NodeJS.Timeout | null = null;

/**
 * Probe PostgreSQL network connectivity (Quick check)
 */
export async function probePostgres(): Promise<boolean> {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    isPostgresOnline = true;
    return true;
  } catch (err) {
    isPostgresOnline = false;
    return false;
  }
}

/**
 * Detailed PostgreSQL connection and sync telemetry probe
 */
export async function checkConnectionAndStatus(tenantId?: string): Promise<CentralDbStatus> {
  const checkedAt = new Date().toISOString();
  const activeTenant = tenantId && tenantId !== 'all' ? tenantId : undefined;
  
  const allLocal = localEncryptedDb.getAll(activeTenant).data;
  const pendingLocal = localEncryptedDb.getPendingSync().filter(p => {
    if (!activeTenant) return true;
    return (p.tenantId || p.clinicId || 'clinic-4b-rampur') === activeTenant;
  });

  const startTime = Date.now();

  try {
    const client = await pool.connect();
    const infoRes = await client.query(`
      SELECT current_database() as db_name, 
             inet_server_addr() as server_ip, 
             inet_server_port() as server_port, 
             version() as pg_version
    `);
    const tenantCountRes = await client.query('SELECT COUNT(*) FROM tenants');
    const totalPatientsRes = await client.query('SELECT COUNT(*) FROM patients');
    
    let tenantPatientsCount = 0;
    if (activeTenant) {
      const tenantPatientsRes = await client.query(
        'SELECT COUNT(*) FROM patients WHERE tenant_id = $1',
        [activeTenant]
      );
      tenantPatientsCount = parseInt(tenantPatientsRes.rows[0].count, 10);
    } else {
      tenantPatientsCount = parseInt(totalPatientsRes.rows[0].count, 10);
    }

    client.release();

    const latencyMs = Date.now() - startTime;
    isPostgresOnline = true;

    const row = infoRes.rows[0] || {};

    return {
      online: true,
      latencyMs,
      host: row.server_ip || 'localhost',
      database: row.db_name || 'maternal_vault',
      port: row.server_port || 5432,
      serverVersion: row.pg_version ? row.pg_version.split(' ')[0] + ' ' + row.pg_version.split(' ')[1] : 'PostgreSQL 16+',
      postgresTotalPatients: parseInt(totalPatientsRes.rows[0].count, 10),
      postgresTenantPatients: tenantPatientsCount,
      postgresTenantsCount: parseInt(tenantCountRes.rows[0].count, 10),
      localTotalRecords: allLocal.length,
      localPendingRecords: pendingLocal.length,
      localSyncedRecords: allLocal.length - pendingLocal.length,
      activeClinicId: activeTenant || 'all',
      lastSyncAttempt,
      lastSuccessfulSync,
      checkedAt,
    };
  } catch (err: any) {
    isPostgresOnline = false;
    return {
      online: false,
      latencyMs: null,
      host: null,
      database: null,
      port: null,
      serverVersion: null,
      postgresTotalPatients: 0,
      postgresTenantPatients: 0,
      postgresTenantsCount: 0,
      localTotalRecords: allLocal.length,
      localPendingRecords: pendingLocal.length,
      localSyncedRecords: allLocal.length - pendingLocal.length,
      activeClinicId: activeTenant || 'all',
      lastSyncAttempt,
      lastSuccessfulSync,
      checkedAt,
      error: err.message || 'Could not establish connection to central PostgreSQL database.',
    };
  }
}

/**
 * Upsert a single patient into central PostgreSQL with full tenant relations and jsonb columns
 */
async function upsertToPostgres(p: Patient): Promise<void> {
  const query = `
    INSERT INTO patients (
      id, tenant_id, name, initials, initials_color, age, dob, phone, nic_no,
      gravida, para, living_children, abortions,
      gestational_weeks, gestational_days, trimester,
      bp_systolic, bp_diastolic, is_bp_alert, bmi, bmi_category, bmi_status_class,
      risk_tier, risk_title, risk_subtitle, preterm_probability,
      alert_headline, alert_details, feature_weights, ml_risk_assessment, notes,
      village, locality, abha_id, blood_group, registration_date, edd, lmp, poa_at_booking,
      height_cm, weight_kg, partner_name, partner_age, partner_occupation, moh_area, phm_register_no,
      fundal_height, is_fundal_alert, hb, is_hb_alert, fhr, is_fhr_alert,
      intended_hospital, emergency_transport_ready,
      medical_history, lab_results, immunization, past_obstetric_history, anc_visits,
      sync_status, sync_node, sync_protocol,
      assessed_by, assessed_time, assessed_location, specific_condition,
      updated_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9,
      $10, $11, $12, $13,
      $14, $15, $16,
      $17, $18, $19, $20, $21, $22,
      $23, $24, $25, $26,
      $27, $28, $29, $30, $31,
      $32, $33, $34, $35, $36, $37, $38, $39,
      $40, $41, $42, $43, $44, $45, $46,
      $47, $48, $49, $50, $51, $52,
      $53, $54,
      $55, $56, $57, $58, $59,
      $60, $61, $62,
      $63, $64, $65, $66,
      NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
      tenant_id = COALESCE(EXCLUDED.tenant_id, patients.tenant_id),
      name = EXCLUDED.name,
      initials = EXCLUDED.initials,
      initials_color = EXCLUDED.initials_color,
      age = EXCLUDED.age,
      dob = EXCLUDED.dob,
      phone = EXCLUDED.phone,
      nic_no = EXCLUDED.nic_no,
      gravida = EXCLUDED.gravida,
      para = EXCLUDED.para,
      living_children = EXCLUDED.living_children,
      abortions = EXCLUDED.abortions,
      gestational_weeks = EXCLUDED.gestational_weeks,
      gestational_days = EXCLUDED.gestational_days,
      trimester = EXCLUDED.trimester,
      bp_systolic = EXCLUDED.bp_systolic,
      bp_diastolic = EXCLUDED.bp_diastolic,
      is_bp_alert = EXCLUDED.is_bp_alert,
      bmi = EXCLUDED.bmi,
      bmi_category = EXCLUDED.bmi_category,
      bmi_status_class = EXCLUDED.bmi_status_class,
      risk_tier = EXCLUDED.risk_tier,
      risk_title = EXCLUDED.risk_title,
      risk_subtitle = EXCLUDED.risk_subtitle,
      preterm_probability = EXCLUDED.preterm_probability,
      alert_headline = EXCLUDED.alert_headline,
      alert_details = EXCLUDED.alert_details,
      feature_weights = EXCLUDED.feature_weights,
      ml_risk_assessment = EXCLUDED.ml_risk_assessment,
      notes = EXCLUDED.notes,
      village = EXCLUDED.village,
      locality = EXCLUDED.locality,
      abha_id = EXCLUDED.abha_id,
      blood_group = EXCLUDED.blood_group,
      registration_date = EXCLUDED.registration_date,
      edd = EXCLUDED.edd,
      lmp = EXCLUDED.lmp,
      poa_at_booking = EXCLUDED.poa_at_booking,
      height_cm = EXCLUDED.height_cm,
      weight_kg = EXCLUDED.weight_kg,
      partner_name = EXCLUDED.partner_name,
      partner_age = EXCLUDED.partner_age,
      partner_occupation = EXCLUDED.partner_occupation,
      moh_area = EXCLUDED.moh_area,
      phm_register_no = EXCLUDED.phm_register_no,
      fundal_height = EXCLUDED.fundal_height,
      is_fundal_alert = EXCLUDED.is_fundal_alert,
      hb = EXCLUDED.hb,
      is_hb_alert = EXCLUDED.is_hb_alert,
      fhr = EXCLUDED.fhr,
      is_fhr_alert = EXCLUDED.is_fhr_alert,
      intended_hospital = EXCLUDED.intended_hospital,
      emergency_transport_ready = EXCLUDED.emergency_transport_ready,
      medical_history = EXCLUDED.medical_history,
      lab_results = EXCLUDED.lab_results,
      immunization = EXCLUDED.immunization,
      past_obstetric_history = EXCLUDED.past_obstetric_history,
      anc_visits = EXCLUDED.anc_visits,
      sync_status = 'synced-p2p',
      sync_node = 'Central PostgreSQL',
      sync_protocol = 'HTTPS TLS 1.3 / Central DB Push',
      assessed_by = EXCLUDED.assessed_by,
      assessed_time = EXCLUDED.assessed_time,
      assessed_location = EXCLUDED.assessed_location,
      specific_condition = EXCLUDED.specific_condition,
      updated_at = NOW();
  `;

  const tenantId = p.tenantId || p.clinicId || 'clinic-4b-rampur';

  await pool.query(query, [
    p.id,
    tenantId,
    p.name,
    p.initials || null,
    p.initialsColor || null,
    p.age,
    p.dob || null,
    p.phone || null,
    p.nicNo || null,
    p.gravida,
    p.para,
    p.livingChildren ?? 0,
    p.abortions ?? 0,
    p.gestationalWeeks,
    p.gestationalDays ?? 0,
    p.trimester,
    p.bpSystolic,
    p.bpDiastolic,
    p.isBpAlert ?? false,
    p.bmi,
    p.bmiCategory || null,
    p.bmiStatusClass || null,
    p.riskTier,
    p.riskTitle,
    p.riskSubtitle || null,
    p.pretermProbability,
    p.alertHeadline || null,
    p.alertDetails || null,
    JSON.stringify(p.featureWeights || []),
    p.mlRiskAssessment ? JSON.stringify(p.mlRiskAssessment) : null,
    p.notes || null,
    p.village || null,
    p.locality || null,
    p.abhaId || null,
    p.bloodGroup || null,
    p.registrationDate || null,
    p.edd || null,
    p.lmp || null,
    p.poaAtBooking || null,
    p.heightCm ?? null,
    p.weightKg ?? null,
    p.partnerName || null,
    p.partnerAge ?? null,
    p.partnerOccupation || null,
    p.mohArea || null,
    p.phmRegisterNo || null,
    p.fundalHeight || null,
    p.isFundalAlert ?? false,
    p.hb ?? null,
    p.isHbAlert ?? false,
    p.fhr || null,
    p.isFhrAlert ?? false,
    p.intendedHospital || null,
    p.emergencyTransportReady ?? true,
    JSON.stringify(p.medicalHistory || {}),
    JSON.stringify(p.labResults || {}),
    JSON.stringify(p.immunization || {}),
    JSON.stringify(p.pastObstetricHistory || []),
    JSON.stringify(p.ancVisits || []),
    'synced-p2p',
    'Central PostgreSQL',
    'HTTPS TLS 1.3 / Central DB Push',
    p.assessedBy || null,
    p.assessedTime || null,
    p.assessedLocation || null,
    p.specificCondition || null,
  ]);
}

/**
 * Push pending/un-synced local records up into PostgreSQL (Checks connection before push)
 */
export async function syncLocalToPostgres(tenantId?: string): Promise<{
  success: boolean;
  syncedCount: number;
  pendingCount: number;
  totalSyncedInDb: number;
  message: string;
  connectionStatus: CentralDbStatus;
}> {
  lastSyncAttempt = new Date().toISOString();
  
  // 1. Check connection first
  const connStatus = await checkConnectionAndStatus(tenantId);
  if (!connStatus.online) {
    return {
      success: false,
      syncedCount: 0,
      pendingCount: connStatus.localPendingRecords,
      totalSyncedInDb: connStatus.postgresTenantPatients,
      message: 'PostgreSQL network destination is currently offline. All changes remain securely protected in Local Encrypted DB.',
      connectionStatus: connStatus,
    };
  }

  // 2. Identify pending records
  const activeTenant = tenantId && tenantId !== 'all' ? tenantId : undefined;
  const pending = localEncryptedDb.getPendingSync().filter(p => {
    if (!activeTenant) return true;
    return (p.tenantId || p.clinicId || 'clinic-4b-rampur') === activeTenant;
  });

  if (pending.length === 0) {
    lastSuccessfulSync = new Date().toISOString();
    return {
      success: true,
      syncedCount: 0,
      pendingCount: 0,
      totalSyncedInDb: connStatus.postgresTenantPatients,
      message: 'All local records for this clinic are already fully synchronized with the Central PostgreSQL database.',
      connectionStatus: connStatus,
    };
  }

  // 3. Push each record to PostgreSQL
  let syncedCount = 0;
  for (const patient of pending) {
    try {
      await upsertToPostgres(patient);
      localEncryptedDb.markSynced(patient.id, 'Central PostgreSQL', 'HTTPS TLS 1.3 / Central DB Push');
      syncedCount++;
    } catch (err) {
      console.error(`Failed to push patient ${patient.id} to PostgreSQL:`, err);
    }
  }

  lastSuccessfulSync = new Date().toISOString();
  console.log(`📡 Central DB Sync completed: ${syncedCount} records pushed from Local Encrypted DB to PostgreSQL.`);

  // Get refreshed status
  const refreshedStatus = await checkConnectionAndStatus(tenantId);

  return {
    success: true,
    syncedCount,
    pendingCount: refreshedStatus.localPendingRecords,
    totalSyncedInDb: refreshedStatus.postgresTenantPatients,
    message: `Successfully pushed ${syncedCount} patient record(s) to Central PostgreSQL Database.`,
    connectionStatus: refreshedStatus,
  };
}

/**
 * Background auto-sync daemon
 */
export function startBackgroundSyncWorker(intervalMs = 20000): void {
  if (syncWorkerTimer) clearInterval(syncWorkerTimer);

  syncWorkerTimer = setInterval(async () => {
    const online = await probePostgres();
    if (online) {
      // 1. Push pending local patient records to PostgreSQL if any
      const pending = localEncryptedDb.getPendingSync();
      if (pending.length > 0) {
        console.log(`🔄 Network detected! Auto-syncing ${pending.length} pending local records to PostgreSQL...`);
        await syncLocalToPostgres();
      }

      // 2. Automatically sync any new/updated clinics or staff credentials from PostgreSQL into local encrypted DB
      await tenantStore.syncAllFromCloud();
    }
  }, intervalMs);

  console.log(`⚙️  Opportunistic Background Sync Worker active (polling interval: ${intervalMs / 1000}s).`);
}

/**
 * Get current sync telemetry status
 */
export function getSyncTelemetry(tenantId?: string): SyncTelemetry {
  const activeTenant = tenantId && tenantId !== 'all' ? tenantId : undefined;
  const pending = localEncryptedDb.getPendingSync().filter(p => {
    if (!activeTenant) return true;
    return (p.tenantId || p.clinicId || 'clinic-4b-rampur') === activeTenant;
  });

  return {
    isPostgresOnline,
    pendingRecordsCount: pending.length,
    lastSyncAttempt,
    lastSuccessfulSync,
    syncMode: isPostgresOnline ? 'PostgreSQL Synchronized' : 'Local Encrypted Primary',
    autoSyncEnabled: syncWorkerTimer !== null,
  };
}

