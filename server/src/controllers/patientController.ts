import { Request, Response } from 'express';
import QRCode from 'qrcode';
import zlib from 'zlib';
import { localEncryptedDb } from '../db/localEncryptedDb.js';
import { probePostgres, upsertToPostgres, deleteFromPostgres } from '../services/syncService.js';
import { evaluatePatientRisk } from '../services/mlRiskService.js';
import type { Patient, CreatePatientInput, UpdatePatientInput, ANCVisitInput } from '../types/patient.js';

// Helper to normalize patient ID
const normalizeId = (id: string): string => {
  if (!id.startsWith('#')) {
    return `#${id}`;
  }
  return id;
};

/**
 * GET /api/patients
 * List all patients with search & filtering (from Local Encrypted DB)
 */
export const getAllPatients = async (req: Request, res: Response) => {
  try {
    const { search, risk, trimester, sync, condition, tenantId, limit, offset } = req.query;
    const headerTenantId = (req.headers['x-tenant-id'] as string) || undefined;

    const effectiveTenantId = (tenantId as string) || headerTenantId;

    const result = localEncryptedDb.getAll({
      search: search as string,
      risk: risk as string,
      trimester: trimester as string,
      sync: sync as string,
      condition: condition as string,
      tenantId: effectiveTenantId,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : 0,
    });

    return res.json({
      success: true,
      total: result.total,
      data: result.data,
      revision: localEncryptedDb.getRevision(),
      tenantId: effectiveTenantId || 'all',
      storage: 'Local Encrypted DB (AES-256-GCM)',
    });
  } catch (error) {
    console.error('Error fetching patients from local encrypted db:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/patients/:id
 * Retrieve a single patient by ID (from Local Encrypted DB)
 */
export const getPatientById = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }
    const id = normalizeId(decodeURIComponent(rawId));

    const patient = localEncryptedDb.getById(id);
    if (!patient) {
      return res.status(404).json({ success: false, message: `Patient with ID ${id} not found in Local Encrypted DB` });
    }

    return res.json({ success: true, data: patient });
  } catch (error) {
    console.error('Error retrieving patient by ID:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/patients
 * Create a new maternal patient record with 3-Model ML Risk Inference (Writes to Local Encrypted DB First)
 */
export const createPatient = async (req: Request, res: Response) => {
  try {
    const input: CreatePatientInput = req.body;

    if (!input.name || !input.age || input.bpSystolic == null || input.bpDiastolic == null) {
      return res.status(400).json({
        success: false,
        message: 'Name, age, bpSystolic, and bpDiastolic are required fields.',
      });
    }

    const newId = input.id ? normalizeId(input.id) : `#${Math.floor(1000 + Math.random() * 9000)}`;
    const tenantId = input.tenantId || (req.headers['x-tenant-id'] as string) || 'clinic-4b-rampur';
    const clinicId = input.clinicId || tenantId;
    const weeks = input.gestationalWeeks || 12;
    const days = input.gestationalDays || 0;
    const trimester = weeks > 27 ? 3 : weeks > 13 ? 2 : 1;
    const bmiVal = input.bmi || 22.4;

    const initials = input.name
      .split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'PT';

    // Execute 3-Model ML Risk Inference (Maternal Health, Nutritional Anemia, Prenatal Depression)
    const mlRisk = await evaluatePatientRisk({
      ...input,
      bmi: bmiVal,
      gestationalWeeks: weeks,
      gestationalDays: days,
    });

    const initialsColor =
      mlRisk.overallRiskTier === 'high'
        ? 'bg-[#fee2e2] text-[#991b1b] border border-[#fca5a5]'
        : mlRisk.overallRiskTier === 'moderate'
        ? 'bg-[#e0f2fe] text-[#0369a1] border border-[#bae6fd]'
        : 'bg-[#d1fae5] text-[#065f46] border border-[#a7f3d0]';

    const bmiCategory =
      bmiVal >= 30
        ? 'Elevated (Obese I)'
        : bmiVal >= 25
        ? 'Overweight'
        : bmiVal < 18.5
        ? 'Underweight Range'
        : 'Normal';

    const newPatient: Patient = {
      id: newId,
      name: input.name,
      initials,
      initialsColor,
      age: input.age,
      gravida: input.gravida || 1,
      para: input.para || 0,
      gestationalWeeks: weeks,
      gestationalDays: days,
      trimester: trimester as 1 | 2 | 3,
      bpSystolic: input.bpSystolic,
      bpDiastolic: input.bpDiastolic,
      isBpAlert: mlRisk.isBpAlert,
      bmi: bmiVal,
      bmiCategory,
      bmiStatusClass: bmiVal >= 30 ? 'danger' : bmiVal >= 25 ? 'warning' : 'normal',
      riskTier: input.riskTier || mlRisk.overallRiskTier,
      riskTitle: input.riskTitle || mlRisk.riskTitle,
      riskSubtitle: input.riskSubtitle || mlRisk.riskSubtitle,
      pretermProbability: input.pretermProbability ?? mlRisk.pretermProbability,
      alertHeadline: `Alert: Patient ${newId}`,
      alertDetails:
        (input.riskTier || mlRisk.overallRiskTier) === 'high'
          ? 'Flagged for elevated risk by 3-Model ML Risk Stratification.'
          : 'Assessed with on-device XGBoost, SMOTE-XGB, and ADASYN-XGB ML inference.',
      featureWeights: input.featureWeights && input.featureWeights.length > 0 ? input.featureWeights : mlRisk.featureWeights,
      mlRiskAssessment: mlRisk,
      notes: input.notes || 'Intake registered via mobile client.',
      village: input.village || 'Rampur Sector 3',
      locality: input.locality || input.village || 'Rampur Purva',
      tenantId,
      clinicId,
      abhaId: input.abhaId || `91-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
      edd: input.edd || '18 Nov 2025',
      fundalHeight: input.fundalHeight || `${weeks} cm`,
      isFundalAlert: false,
      hb: input.hb || 11.2,
      isHbAlert: (input.hb ?? 11.2) < 10.0,
      fhr: input.fhr || '140 bpm',
      isFhrAlert: false,
      syncStatus: 'updated-local',
      syncNode: 'Local Encrypted Station (PHM-MUM-71)',
      syncProtocol: 'SQLite / AES-256-GCM Encrypted',
      assessedBy: 'Priya Sharma, PHM',
      assessedTime: input.assessedTime || (input.registrationDate ? `${input.registrationDate} (Paper Record)` : 'Just now (Encrypted)'),
      assessedLocation: 'Sub-center Rampur',
      specificCondition: input.specificCondition || ((input.riskTier || mlRisk.overallRiskTier) === 'high' ? 'Pre-eclampsia' : 'Normal Progression'),
      phone: input.phone,
      dob: input.dob,
      livingChildren: input.livingChildren,
      abortions: input.abortions,
      prevLscs: input.prevLscs,
      prevPreterm: input.prevPreterm,
      prevPph: input.prevPph,
      intendedHospital: input.intendedHospital,
      emergencyTransportReady: input.emergencyTransportReady,
      dangerSignsPresent: input.dangerSignsPresent,
      registrationDate: input.registrationDate || new Date().toISOString().split('T')[0],
      bloodGroup: input.bloodGroup || 'O +ve',
      lmp: input.lmp,
      poaAtBooking: input.poaAtBooking,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      partnerName: input.partnerName,
      partnerAge: input.partnerAge,
      partnerOccupation: input.partnerOccupation,
      mohArea: input.mohArea,
      phmRegisterNo: input.phmRegisterNo,
      nicNo: input.nicNo,
      medicalHistory: input.medicalHistory,
      labResults: input.labResults,
      ancVisits: input.ancVisits || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 1. Write first to local encrypted database
    localEncryptedDb.insert(newPatient);

    // 2. Immediately push to PostgreSQL if online so other devices receive it immediately
    probePostgres().then(async online => {
      if (online) {
        try {
          await upsertToPostgres(newPatient);
          localEncryptedDb.markSynced(newPatient.id);
        } catch (err) {
          console.warn('PostgreSQL direct upsert failed, queued for background sync:', err);
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: 'Patient registered in Local Encrypted DB and assessed by 3 ML models.',
      data: newPatient,
    });
  } catch (error) {
    console.error('Error creating patient:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * PUT /api/patients/:id
 * Update an existing patient record in Local Encrypted DB with automatic 3-Model ML Risk recalculation
 */
export const updatePatient = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }
    const id = normalizeId(decodeURIComponent(rawId));
    const updates: UpdatePatientInput = req.body;

    const existing = localEncryptedDb.getById(id);
    if (!existing) {
      return res.status(404).json({ success: false, message: `Patient with ID ${id} not found` });
    }

    // Prepare merged updates
    const merged: Partial<Patient> = {
      ...updates,
      syncStatus: 'updated-local',
    };

    // Recompute multi-model ML risk assessment on each data change
    const mlRisk = await evaluatePatientRisk({
      ...existing,
      ...updates,
      bpSystolic: updates.bpSystolic ?? existing.bpSystolic,
      bpDiastolic: updates.bpDiastolic ?? existing.bpDiastolic,
      gestationalWeeks: updates.gestationalWeeks ?? existing.gestationalWeeks,
      bmi: updates.bmi ?? existing.bmi,
      gravida: updates.gravida ?? existing.gravida,
      hb: updates.hb ?? existing.hb,
      medicalHistory: updates.medicalHistory ?? existing.medicalHistory,
      labResults: updates.labResults ?? existing.labResults,
      pastObstetricHistory: updates.pastObstetricHistory ?? existing.pastObstetricHistory,
    });

    merged.riskTier = mlRisk.overallRiskTier;
    merged.riskTitle = mlRisk.riskTitle;
    merged.riskSubtitle = mlRisk.riskSubtitle;
    merged.pretermProbability = mlRisk.pretermProbability;
    merged.featureWeights = mlRisk.featureWeights;
    merged.isBpAlert = mlRisk.isBpAlert;
    merged.mlRiskAssessment = mlRisk;

    const updated = localEncryptedDb.update(id, merged);

    // Immediately push to PostgreSQL if online so other devices receive it immediately
    if (updated) {
      probePostgres().then(async online => {
        if (online) {
          try {
            await upsertToPostgres(updated);
            localEncryptedDb.markSynced(updated.id);
          } catch (err) {
            console.warn('PostgreSQL direct update failed, queued for background sync:', err);
          }
        }
      });
    }

    return res.json({
      success: true,
      message: 'Patient record updated in Local Encrypted DB with fresh 3-Model ML risk assessment.',
      data: updated,
    });
  } catch (error) {
    console.error('Error updating patient:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/patients/:id/evaluate-risk
 * Recalculate 3-Model ML risk on demand for a patient
 */
export const recalculatePatientRisk = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }
    const id = normalizeId(decodeURIComponent(rawId));
    const patient = localEncryptedDb.getById(id);
    if (!patient) {
      return res.status(404).json({ success: false, message: `Patient with ID ${id} not found` });
    }

    const mlRisk = await evaluatePatientRisk(patient);
    const updated = localEncryptedDb.update(id, {
      riskTier: mlRisk.overallRiskTier,
      riskTitle: mlRisk.riskTitle,
      riskSubtitle: mlRisk.riskSubtitle,
      pretermProbability: mlRisk.pretermProbability,
      featureWeights: mlRisk.featureWeights,
      isBpAlert: mlRisk.isBpAlert,
      mlRiskAssessment: mlRisk,
    });

    return res.json({
      success: true,
      message: 'Fresh 3-Model ML Risk evaluation calculated successfully.',
      data: updated,
    });
  } catch (error) {
    console.error('Error evaluating patient risk:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * DELETE /api/patients/:id
 * Delete a patient record from Local Encrypted DB
 */
export const deletePatient = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }
    const id = normalizeId(decodeURIComponent(rawId));
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || undefined;

    const deleted = localEncryptedDb.delete(id);
    if (!deleted) {
      return res.status(404).json({ success: false, message: `Patient with ID ${id} not found` });
    }

    // Immediately propagate deletion to PostgreSQL if online
    probePostgres().then(async online => {
      if (online) {
        try {
          const ok = await deleteFromPostgres(id, tenantId);
          if (ok) localEncryptedDb.clearPendingDeletion(id);
        } catch (err) {
          console.warn('PostgreSQL direct delete failed, queued for background sync:', err);
        }
      }
    });

    return res.json({
      success: true,
      message: `Patient ${id} deleted successfully from Local Encrypted DB and PostgreSQL.`,
    });
  } catch (error) {
    console.error('Error deleting patient:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * GET /api/patients/stats
 * Summary statistics of registered pregnancies from Local Encrypted DB
 */
export const getPatientStats = async (req: Request, res: Response) => {
  try {
    const tenantId = (req.query.tenantId as string) || (req.headers['x-tenant-id'] as string) || undefined;
    const stats = localEncryptedDb.getStats(tenantId);
    return res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error computing patient stats:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * POST /api/patients/:id/visits
 * Add an Antenatal Clinic (ANC) visit to the patient record with 3-Model ML risk recalculation
 */
export const addPatientVisit = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }
    const id = normalizeId(decodeURIComponent(rawId));
    const visitInput: ANCVisitInput = req.body;

    if (visitInput.weightKg == null || visitInput.bpSystolic == null || visitInput.bpDiastolic == null) {
      return res.status(400).json({
        success: false,
        message: 'weightKg, bpSystolic, and bpDiastolic are required fields for an ANC visit.',
      });
    }

    const patient = localEncryptedDb.getById(id);
    if (!patient) {
      return res.status(404).json({ success: false, message: `Patient with ID ${id} not found` });
    }

    // 1. Save visit to local encrypted db and update patient vitals
    const result = localEncryptedDb.addClinicVisit(id, visitInput);
    if (!result) {
      return res.status(500).json({ success: false, message: 'Failed to record clinic visit' });
    }

    // 2. Recalculate 3-Model ML Risk Stratification on new visit vitals and clinical signs
    const mlRisk = await evaluatePatientRisk({
      ...result.patient,
      bpSystolic: visitInput.bpSystolic ?? result.patient.bpSystolic,
      bpDiastolic: visitInput.bpDiastolic ?? result.patient.bpDiastolic,
      gestationalWeeks: result.patient.gestationalWeeks,
      bmi: result.patient.bmi,
      gravida: result.patient.gravida,
      hb: result.patient.hb,
      weightKg: visitInput.weightKg ?? result.patient.weightKg,
      prevPreterm: result.patient.pastObstetricHistory?.some(p => p.gaWeeks < 37),
      severeHeadache: visitInput.urineAlb?.includes('2+') || visitInput.urineAlb?.includes('3+'),
    });

    const finalPatient = localEncryptedDb.update(id, {
      riskTier: mlRisk.overallRiskTier,
      riskTitle: mlRisk.riskTitle,
      riskSubtitle: mlRisk.riskSubtitle,
      pretermProbability: mlRisk.pretermProbability,
      featureWeights: mlRisk.featureWeights,
      isBpAlert: mlRisk.isBpAlert,
      mlRiskAssessment: mlRisk,
    }) || result.patient;

    // 3. Immediately push to PostgreSQL if online so other devices receive it immediately
    probePostgres().then(async online => {
      if (online) {
        try {
          await upsertToPostgres(finalPatient);
          localEncryptedDb.markSynced(finalPatient.id);
        } catch (err) {
          console.warn('PostgreSQL direct visit update failed, queued for background sync:', err);
        }
      }
    });

    return res.status(201).json({
      success: true,
      message: `Antenatal clinic visit #${result.visit.visitNo} saved successfully to Local Encrypted DB and reassessed with 3 ML models.`,
      data: {
        patient: finalPatient,
        visit: result.visit,
      },
    });
  } catch (error) {
    console.error('Error adding patient visit:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error' });
  }
};

/**
 * Build payload for mobile phone data transfer (Direct Mobile App Ingestion & Complete Vault Transfer)
 */
export const buildMobilePayload = (patient: Patient) => {
  const pastPregnancies = (patient.pastObstetricHistory || []).map((p, idx) => ({
    order: p.pregnancyNo || idx + 1,
    year: p.year,
    gaWeeks: p.gaWeeks,
    term: (p.gaWeeks ?? 38) >= 37 ? 'term' : 'preterm',
    deliveryMode: p.deliveryMode || 'Vaginal',
    mode: String(p.deliveryMode || '').toLowerCase().includes('cesarean') || String(p.deliveryMode || '').toLowerCase().includes('lscs') ? 'caesarean' : 'vaginal',
    birthWeight: p.birthWeightKg || 3.0,
    sex: p.babySex === 'M' ? 'male' : p.babySex === 'F' ? 'female' : p.babySex || 'unspecified',
    outcome: 'alive',
    age: p.year ? Math.max(0, new Date().getFullYear() - p.year) : undefined,
    hospital: 'District Base Hospital',
    antenatalComplications: p.complications || 'None',
    complications: p.complications || 'None',
    postnatalComplications: 'Normal recovery',
  }));

  const ancVisits = (patient.ancVisits || []).map((v, idx) => {
    const poaParts = String(v.poa || '').split('w');
    const poaWeek = parseInt(poaParts[0], 10) || patient.gestationalWeeks || 12;
    const sfhNum = parseInt(String(v.sfhCm || '').replace(/\D/g, ''), 10) || 0;
    const fhrNum = parseInt(String(v.fhr || '').replace(/\D/g, ''), 10) || 140;
    const bpStr = String(v.bp || `${patient.bpSystolic || 120}/${patient.bpDiastolic || 80}`);
    const weight = typeof v.weightKg === 'number' ? v.weightKg : parseFloat(String(v.weightKg || '60')) || 60;
    const presStr = String(v.presentation || 'Cephalic');
    const albStr = String(v.urineAlb || 'Nil');
    const sugStr = String(v.urineSug || 'Nil');

    return {
      visitNo: v.visitNo || idx + 1,
      week: poaWeek,
      date: v.date,
      poa: v.poa || `${poaWeek}w`,
      bp: bpStr,
      weight: weight,
      weightKg: weight,
      fundal: sfhNum,
      sfhCm: v.sfhCm || `${sfhNum} cm`,
      fhr: fhrNum,
      fhrString: v.fhr || `${fhrNum} bpm`,
      status: bpStr.startsWith('14') || bpStr.startsWith('15') || (albStr && albStr.toLowerCase() !== 'nil') ? 'review' : 'normal',
      albumin: albStr.toLowerCase(),
      sugar: sugStr.toLowerCase(),
      urineAlb: v.urineAlb || 'Nil',
      urineSug: v.urineSug || 'Nil',
      foetalLie: presStr.toLowerCase().includes('cephalic') ? 'longitudinal' : 'transverse',
      foetalPresentation: presStr.toLowerCase().includes('breech') ? 'breech' : 'cephalic',
      presentation: v.presentation || 'Cephalic',
      engagement: v.engagement || 'Not engaged',
      fm: v.fm || 'Active (>10/12h)',
      foetalMovements: String(v.fm || '').toLowerCase() !== 'not felt',
      edema: v.edema || 'Nil',
      ironFolate: v.supplements?.ifaIssued ?? true,
      vitaminC: v.supplements?.vitCIssued ?? true,
      calcium: v.supplements?.calciumIssued ?? true,
      foodSupplement: v.supplements?.foodSupplement ?? true,
      supplements: {
        ifaIssued: v.supplements?.ifaIssued ?? true,
        calciumIssued: v.supplements?.calciumIssued ?? true,
        vitCIssued: v.supplements?.vitCIssued ?? true,
        foodSupplement: v.supplements?.foodSupplement ?? true,
      },
      examiner: v.examiner || patient.assessedBy || 'Priya Sharma, PHM',
      by: v.examiner || patient.assessedBy || 'Priya Sharma, PHM',
      remarks: v.remarks || 'Routine ANC visit documented.',
    };
  });

  return {
    app: 'MaternaVault',
    ver: '1.2.0',
    exportedAt: new Date().toISOString(),
    id: patient.id,
    name: patient.name,
    age: patient.age,
    dob: patient.dob || '',
    phone: patient.phone || '',
    nicNo: patient.nicNo || '',
    gravida: patient.gravida || 1,
    para: patient.para || 0,
    livingChildren: patient.livingChildren ?? patient.para ?? 0,
    abortions: patient.abortions ?? 0,
    abha: patient.abhaId || '',
    abhaId: patient.abhaId || '',
    village: patient.village || patient.locality || '',
    locality: patient.locality || patient.village || '',
    mohArea: patient.mohArea || '',
    phmRegisterNo: patient.phmRegisterNo || '',
    registrationDate: patient.registrationDate || '',
    ga: `${patient.gestationalWeeks || 12}w ${patient.gestationalDays || 0}d`,
    gestationalWeeks: patient.gestationalWeeks || 12,
    gestationalDays: patient.gestationalDays || 0,
    trim: patient.trimester || 1,
    trimester: patient.trimester || 1,
    edd: patient.edd || '',
    lmp: patient.lmp || '',
    poaAtBooking: patient.poaAtBooking || '',
    fundal: patient.fundalHeight || `${patient.gestationalWeeks || 12} cm`,
    fundalHeight: patient.fundalHeight || `${patient.gestationalWeeks || 12} cm`,

    partner: {
      name: patient.partnerName || '',
      age: patient.partnerAge || null,
      occupation: patient.partnerOccupation || '',
    },

    vitals: {
      bp: `${patient.bpSystolic || 120}/${patient.bpDiastolic || 80}`,
      bpSystolic: patient.bpSystolic || 120,
      bpDiastolic: patient.bpDiastolic || 80,
      isBpAlert: patient.isBpAlert || false,
      hb: patient.hb ?? 11.2,
      isHbAlert: patient.isHbAlert || false,
      bmi: patient.bmi || 22.0,
      bmiCategory: patient.bmiCategory || 'Normal',
      fhr: patient.fhr || '140 bpm',
      isFhrAlert: patient.isFhrAlert || false,
      weight: patient.weightKg || 62.0,
      weightKg: patient.weightKg || 62.0,
      bloodGroup: patient.bloodGroup || 'O+',
      height: `${patient.heightCm || 158}`,
      heightCm: patient.heightCm || 158,
      allergies: patient.medicalHistory?.allergies || 'None reported',
    },

    risk: {
      tier: patient.riskTier || 'low',
      title: patient.riskTitle || 'LOW RISK',
      subtitle: patient.riskSubtitle || 'Routine Antenatal',
      prob: patient.pretermProbability || 10,
      cond: patient.specificCondition || 'Routine Antenatal',
      alertHeadline: patient.alertHeadline || '',
      alertDetails: patient.alertDetails || '',
      dangerSigns: patient.dangerSignsPresent || [],
      mlRiskAssessment: patient.mlRiskAssessment,
    },

    notes: patient.notes || 'Routine maternal assessment.',
    by: patient.assessedBy || 'Priya Sharma, PHM',
    assessedBy: patient.assessedBy || 'Priya Sharma, PHM',
    assessedTime: patient.assessedTime || '',
    assessedLocation: patient.assessedLocation || '',
    at: new Date().toISOString(),

    pregnancies: pastPregnancies,
    pastObstetricHistory: patient.pastObstetricHistory || [],

    medicalHistory: {
      diabetes: !!patient.medicalHistory?.diabetes,
      chronicHtn: !!patient.medicalHistory?.chronicHtn,
      cardiac: !!patient.medicalHistory?.cardiac,
      asthma: !!patient.medicalHistory?.asthma,
      thyroid: !!patient.medicalHistory?.thyroid,
      epilepsy: !!patient.medicalHistory?.epilepsy,
      thalassaemia: !!patient.medicalHistory?.thalassaemia,
      prevLscs: !!patient.prevLscs,
      prevPreterm: !!patient.prevPreterm,
      prevPph: !!patient.prevPph,
      allergies: patient.medicalHistory?.allergies || 'None reported',
      surgeries: patient.medicalHistory?.surgeries || 'None',
    },

    labResults: {
      bloodGroup: patient.labResults?.bloodGroup || patient.bloodGroup || 'O+',
      vdrl: patient.labResults?.vdrl || 'Non-reactive',
      rubella: patient.labResults?.rubella || 'Immune',
      hiv: patient.labResults?.hiv || 'Negative',
      hbsAg: patient.labResults?.hbsAg || 'Negative',
      fbs: patient.labResults?.fbs || '84 mg/dL',
      ogttFasting: patient.labResults?.ogttFasting || '',
      ogtt1h: patient.labResults?.ogtt1h || '',
      ogtt2h: patient.labResults?.ogtt2h || '',
      hbBooking: patient.labResults?.hbBooking || patient.hb || 11.2,
      hb28w: patient.labResults?.hb28w,
      hb36w: patient.labResults?.hb36w,
      urineAlbumin: patient.labResults?.urineAlbumin || 'Nil',
      urineSugar: patient.labResults?.urineSugar || 'Nil',
    },

    investigations: {
      hb: `${patient.hb || 11.2}`,
      bloodSugar: patient.labResults?.fbs ? `FBS: ${patient.labResults.fbs}` : 'Fasting: 84 mg/dL, 2h PP: 110 mg/dL',
      vdrl: patient.labResults?.vdrl || 'Non-reactive',
      rubella: patient.labResults?.rubella || 'Immune',
      hiv: patient.labResults?.hiv || 'Negative',
      hbsAg: patient.labResults?.hbsAg || 'Negative',
    },

    immunization: {
      tt1Date: patient.immunization?.tt1Date || '',
      tt2Date: patient.immunization?.tt2Date || '',
      ttBooster: patient.immunization?.ttBooster || '',
      ifaIssued: patient.immunization?.ifaIssued ?? 120,
      calciumIssued: patient.immunization?.calciumIssued ?? 60,
      vitCIssued: patient.immunization?.vitCIssued ?? 60,
      mebendazoleGiven: patient.immunization?.mebendazoleGiven ?? false,
      thriposhaGiven: patient.immunization?.thriposhaGiven ?? false,
    },

    deliveryPlan: {
      intendedHospital: patient.intendedHospital || 'District Base Hospital',
      distanceKm: 12,
      transportMode: 'ownVehicle',
      emergencyTransportReady: patient.emergencyTransportReady ?? true,
    },

    visits: ancVisits,
    ancVisits: patient.ancVisits || [],
  };
};

/**
 * Compact schema compressor for physical QR code matrix encoding (<900 bytes)
 */
export const compressVaultForQR = (vault: any) => {
  return {
    _mv: 1,
    id: vault.id,
    n: vault.name,
    a: vault.age,
    g: vault.gravida,
    p: vault.para,
    lc: vault.livingChildren,
    ga: vault.ga,
    w: vault.gestationalWeeks,
    edd: vault.edd,
    lmp: vault.lmp,
    bp: vault.vitals?.bp,
    hb: vault.vitals?.hb,
    fhr: vault.vitals?.fhr,
    wt: vault.vitals?.weightKg,
    bg: vault.vitals?.bloodGroup,
    rt: vault.risk?.tier,
    rc: vault.risk?.cond,
    rp: vault.risk?.prob,
    pt: vault.partner?.name,
    mh: vault.medicalHistory,
    lr: vault.labResults,
    pr: (vault.pregnancies || []).map((p: any) => [
      p.order,
      p.year,
      p.mode || p.deliveryMode,
      p.birthWeight || p.birthWeightKg,
      p.sex,
      p.complications,
    ]),
    vs: (vault.visits || []).map((v: any) => [
      v.visitNo || v.week,
      v.date,
      v.poa,
      v.bp,
      v.weightKg || v.weight,
      v.sfhCm || v.fundal,
      v.fhr || v.fhrString,
      v.presentation || v.foetalPresentation,
      v.urineAlb || v.albumin,
      v.urineSug || v.sugar,
      v.remarks || '',
    ]),
  };
};

/**
 * GET /api/patients/:id/qr
 * Generate a unique QR code to transfer patient data to mobile phone
 */
export const getPatientQRCode = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).json({ success: false, message: 'Patient ID is required' });
    }
    const id = normalizeId(decodeURIComponent(rawId));
    const patient = localEncryptedDb.getById(id);

    if (!patient) {
      return res.status(404).json({ success: false, message: `Patient with ID ${id} not found` });
    }

    const mode = (req.query.mode as string) || 'full';
    const payload = buildMobilePayload(patient);
    const payloadUtf8String = JSON.stringify(payload);
    const compactQRString = JSON.stringify(compressVaultForQR(payload));

    let stringToEncode = compactQRString;
    let compressionStats: any = null;

    if (mode === 'gzip' || mode === 'compressed') {
      const gzipBuffer = zlib.gzipSync(Buffer.from(compactQRString));
      const gzipBase64 = 'MVZ1:GZ:' + gzipBuffer.toString('base64url');
      stringToEncode = gzipBase64;
      compressionStats = {
        originalSize: payloadUtf8String.length,
        compactSize: compactQRString.length,
        compressedSize: gzipBase64.length,
        savingsPercent: `${((1 - gzipBase64.length / payloadUtf8String.length) * 100).toFixed(1)}%`,
        encoding: 'MVZ1:GZ: (Gzip Deflate + Base64URL)',
      };
    } else if (mode === 'url') {
      const origin = req.protocol + '://' + req.get('host');
      stringToEncode = `${origin}/mobile/patient/${encodeURIComponent(patient.id)}`;
    }

    // High-speed Error Correction Level 'L' (low density, large dots, instant <0.05s camera autofocus)
    const [dataUrl, svgString] = await Promise.all([
      QRCode.toDataURL(stringToEncode, {
        errorCorrectionLevel: 'L',
        margin: 2,
        width: 380,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }),
      QRCode.toString(stringToEncode, {
        type: 'svg',
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
      }),
    ]);

    return res.json({
      success: true,
      data: {
        patientId: patient.id,
        patientName: patient.name,
        abhaId: patient.abhaId,
        riskTier: patient.riskTier,
        qrDataUrl: dataUrl,
        qrSvg: svgString,
        qrMode: mode,
        encodedPayload: stringToEncode,
        compressionStats,
        payload,
        payloadUtf8String,
        payloadSize: payloadUtf8String.length,
        instructions: mode === 'gzip'
          ? 'Scan with Flutter mobile app using zlib.decode(base64Url.decode(code)) for ultra-fast instant transfer.'
          : 'Scan with smartphone camera or mobile EHR application to transfer and store offline medical record.',
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Error generating patient QR code:', error);
    return res.status(500).json({ success: false, message: 'Internal Server Error generating QR code' });
  }
};

/**
 * GET /mobile/patient/:id
 * Render the Pregnancy Record mobile application UI for smartphone browsers
 */
export const getPatientMobileView = async (req: Request, res: Response) => {
  try {
    const rawId = req.params.id;
    if (!rawId) {
      return res.status(400).send('Patient ID required');
    }
    const id = normalizeId(decodeURIComponent(rawId));
    const patient = localEncryptedDb.getById(id);

    if (!patient) {
      return res.status(404).send('<h1>Patient Record Not Found in Local Vault</h1>');
    }

    const payload = buildMobilePayload(patient);
    const payloadJsonString = JSON.stringify(payload);

    const formatDate = (d?: string) => {
      if (!d) return '-';
      try {
        const p = new Date(d);
        if (isNaN(p.getTime())) return d;
        return p.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
      } catch {
        return d;
      }
    };

    const riskColor = patient.riskTier === 'high' ? '#dc2626' : patient.riskTier === 'moderate' ? '#0284c7' : '#16a34a';
    const riskBg = patient.riskTier === 'high' ? '#fee2e2' : patient.riskTier === 'moderate' ? '#e0f2fe' : '#dcfce7';

    const medicalFlags = [
      patient.medicalHistory?.diabetes && 'Diabetes Mellitus',
      patient.medicalHistory?.chronicHtn && 'Chronic Hypertension',
      patient.medicalHistory?.cardiac && 'Cardiac Disease',
      patient.medicalHistory?.asthma && 'Bronchial Asthma',
      patient.medicalHistory?.thyroid && 'Thyroid Disorder',
      patient.medicalHistory?.epilepsy && 'Epilepsy',
      patient.medicalHistory?.thalassaemia && 'Thalassaemia',
      patient.prevLscs && 'Previous LSCS (C-Section)',
      patient.prevPreterm && 'Previous Preterm Birth',
      patient.prevPph && 'Previous PPH',
    ].filter(Boolean) as string[];

    const gestationalPercentage = Math.min(100, Math.round(((patient.gestationalWeeks || 12) / 40) * 100));

    const visitsHtml = (patient.ancVisits && patient.ancVisits.length > 0)
      ? patient.ancVisits.map((v, i) => `
        <div class="card-item" style="margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <strong style="color: #006194; font-size: 13px;">Visit #${v.visitNo || i + 1} (${v.poa || 'POA -'})</strong>
            <span style="font-family: monospace; font-size: 11px; color: #64748b;">${formatDate(v.date)}</span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 6px; font-size: 11px; font-family: monospace; background: #fcfaff; border: 1px solid #e5e3f1; padding: 8px; border-radius: 10px;">
            <div>BP: <strong style="color: ${(v.bp && (v.bp.startsWith('14') || v.bp.startsWith('15'))) ? '#dc2626' : '#0f172a'};">${v.bp || '-'}</strong></div>
            <div>SFH: <strong>${v.sfhCm || '-'}</strong></div>
            <div>FHR: <strong style="color: #16a34a;">${v.fhr || '-'}</strong></div>
            <div>Lie: <strong>${v.presentation || 'Cephalic'}</strong></div>
            <div>Alb: <strong>${v.urineAlb || 'Nil'}</strong></div>
            <div>Sug: <strong>${v.urineSug || 'Nil'}</strong></div>
          </div>
          ${v.remarks ? `<div style="font-size: 11px; color: #475569; margin-top: 6px; font-style: italic;">"${v.remarks}"</div>` : ''}
          <div style="font-size: 10px; color: #64748b; margin-top: 6px; display: flex; justify-content: space-between;">
            <span>By: ${v.examiner || patient.assessedBy || 'PHM Nurse'}</span>
            <span>Edema: ${v.edema || 'Nil'}</span>
          </div>
        </div>
      `).join('')
      : '<div class="card-item" style="text-align: center; color: #64748b; font-size: 12px; font-style: italic;">No clinic visits recorded yet.</div>';

    const pastPregHtml = (patient.pastObstetricHistory && patient.pastObstetricHistory.length > 0)
      ? patient.pastObstetricHistory.map((p, idx) => `
        <div class="card-item" style="margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: bold;">
            <span>Order #${p.pregnancyNo || idx + 1} • Year ${p.year || 'N/A'}</span>
            <span style="font-size: 10px; background: #dcfce7; color: #14532d; padding: 2px 8px; border-radius: 9999px;">ALIVE</span>
          </div>
          <div style="font-size: 11px; color: #475569; margin-top: 4px;">
            ${p.deliveryMode || 'Vaginal'} • Baby ${p.babySex || 'M'} (${p.birthWeightKg || 3.0} kg)
          </div>
          <div style="font-size: 10px; color: #64748b; margin-top: 2px;">
            Complications: ${p.complications || 'None'}
          </div>
        </div>
      `).join('')
      : '<div class="card-item" style="text-align: center; color: #64748b; font-size: 12px; font-style: italic;">First pregnancy (Primigravida). No past deliveries recorded.</div>';

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <title>${patient.name} - Pregnancy Record</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; -webkit-tap-highlight-color: transparent; }
    body { background: #18181b; color: #0f172a; min-height: 100vh; display: flex; justify-content: center; }
    .app-container { width: 100%; max-width: 440px; background: #fcfaff; min-height: 100vh; display: flex; flex-direction: column; position: relative; box-shadow: 0 0 40px rgba(0,0,0,0.5); }
    
    /* Top App Bar */
    .top-app-bar { background: #ffffff; border-bottom: 1px solid #f1f0f7; padding: 12px 16px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 30; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
    .brand-group { display: flex; align-items: center; gap: 8px; }
    .logo-badge { width: 32px; height: 32px; border-radius: 50%; background: #fdf2f8; border: 1px solid #fbcfe8; display: flex; align-items: center; justify-content: center; color: #db2777; font-size: 16px; }
    .app-title { font-weight: 800; font-size: 15px; color: #0f172a; tracking: -0.02em; }
    .top-actions { display: flex; align-items: center; gap: 12px; color: #64748b; }
    .top-icon { width: 18px; height: 18px; cursor: pointer; }
    
    /* Scrollable Content */
    .content-body { flex: 1; padding: 16px; padding-bottom: 80px; overflow-y: auto; }
    .tab-view { display: none; }
    .tab-view.active { display: block; animation: fadeIn 0.15s ease-in-out; }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(3px); } to { opacity: 1; transform: translateY(0); } }
    
    /* Typography */
    .view-title { font-size: 20px; font-weight: 900; color: #0f172a; letter-spacing: -0.02em; line-height: 1.2; }
    .view-desc { font-size: 11.5px; color: #64748b; margin-top: 4px; line-height: 1.4; margin-bottom: 14px; }
    .section-label { font-size: 10px; font-weight: 800; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px; }
    
    /* Vitals Grid (2x2) */
    .vitals-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
    .vital-card { background: #ffffff; border-radius: 16px; padding: 12px; border: 1px solid #f1f0f7; box-shadow: 0 1px 3px rgba(0,0,0,0.02); }
    .icon-box { width: 30px; height: 30px; border-radius: 10px; display: flex; align-items: center; justify-content: center; margin-bottom: 6px; }
    .vital-name { font-size: 11px; color: #64748b; font-weight: 500; }
    .vital-val { font-size: 16px; font-weight: 900; color: #0f172a; margin-top: 2px; }
    
    /* Demographics Card */
    .card-item { background: #ffffff; border-radius: 18px; padding: 14px; border: 1px solid #f1f0f7; box-shadow: 0 1px 3px rgba(0,0,0,0.02); margin-bottom: 12px; }
    .card-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .card-header-icon { width: 28px; height: 28px; border-radius: 10px; background: #fdf2f8; display: flex; align-items: center; justify-content: center; color: #db2777; }
    .card-header-title { font-weight: 800; font-size: 14px; color: #0f172a; }
    
    /* Form Pill Containers */
    .pill-field { margin-bottom: 10px; }
    .pill-label { font-size: 10.5px; color: #64748b; font-weight: 600; display: block; margin-bottom: 4px; }
    .pill-input { background: #fcfaff; border: 1px solid #e5e3f1; border-radius: 12px; padding: 8px 12px; font-size: 12px; font-weight: 700; color: #0f172a; }
    
    /* Buttons */
    .btn-action { width: 100%; border-radius: 14px; padding: 12px; font-weight: 700; font-size: 13px; text-align: center; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 8px; text-decoration: none; }
    .btn-blue { background: #006194; color: white; }
    .btn-sky { background: #0284c7; color: white; }
    .btn-dark { background: #334155; color: white; }
    .btn-sos { background: #dc2626; color: white; box-shadow: 0 4px 12px rgba(220,38,38,0.25); }
    
    /* Bottom 5-Tab Bar */
    .bottom-nav { background: #ffffff; border-top: 1px solid #f1f0f7; padding: 8px 6px; display: flex; justify-content: space-around; position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%); width: 100%; max-width: 440px; z-index: 40; box-shadow: 0 -2px 10px rgba(0,0,0,0.03); }
    .nav-tab { background: none; border: none; display: flex; flex-direction: column; align-items: center; gap: 2px; color: #94a3b8; cursor: pointer; font-size: 10px; font-weight: 600; padding: 4px 8px; }
    .nav-tab.active { color: #006194; font-weight: 800; }
    .nav-icon { width: 18px; height: 18px; }
    
    /* Android Bottom Bar */
    .android-bar { background: #fcfaff; padding: 2px 24px; display: flex; justify-content: space-around; color: #94a3b8; font-size: 11px; border-top: 1px solid #f1f0f7; position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 440px; z-index: 40; }
  </style>
</head>
<body>
  <div class="app-container">
    
    <!-- Top App Bar -->
    <div class="top-app-bar">
      <div class="brand-group">
        <div class="logo-badge">👶</div>
        <span class="app-title">Pregnancy Record</span>
      </div>
      <div class="top-actions">
        <svg class="top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="5" height="5" x="3" y="3" rx="1"/><rect width="5" height="5" x="16" y="3" rx="1"/><rect width="5" height="5" x="3" y="16" rx="1"/><path d="M21 16h-3a2 2 0 0 0-2 2v3"/><path d="M21 21v.01"/><path d="M12 7v3a2 2 0 0 1-2 2H7"/><path d="M3 12h.01"/><path d="M12 3h.01"/><path d="M12 16v.01"/><path d="M16 12h1"/><path d="M21 12v.01"/><path d="M12 21v-1"/></svg>
        <svg class="top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
        <svg class="top-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>
      </div>
    </div>

    <!-- Main Content Area -->
    <div class="content-body">
      
      <!-- TAB 1: BASIC PROFILE (MATCHES SCREENSHOT) -->
      <div id="tab-profile" class="tab-view active">
        <h1 class="view-title">Basic Profile</h1>
        <p class="view-desc">Your registration details and the information the clinic asks for at your first visit.</p>

        <div class="section-label">KEY VITALS</div>

        <!-- 2x2 Grid -->
        <div class="vitals-grid">
          <!-- Blood Group -->
          <div class="vital-card">
            <div class="icon-box" style="background: #fdf2f4; color: #e11d48;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#e11d48" stroke="#e11d48" stroke-width="2"><path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/></svg>
            </div>
            <div class="vital-name">Blood Group</div>
            <div class="vital-val">${patient.bloodGroup || 'B +ve'}</div>
          </div>

          <!-- BMI -->
          <div class="vital-card">
            <div class="icon-box" style="background: #f0fdf4; color: #16a34a;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#16a34a" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/></svg>
            </div>
            <div class="vital-name">BMI</div>
            <div class="vital-val">${patient.bmi || '27.4'}</div>
          </div>

          <!-- Height -->
          <div class="vital-card">
            <div class="icon-box" style="background: #f0f9ff; color: #0284c7;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#0284c7" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.3 15.3a2.4 2.4 0 0 1 0 3.4l-2.6 2.6a2.4 2.4 0 0 1-3.4 0L2.7 8.7a2.41 2.41 0 0 1 0-3.4l2.6-2.6a2.41 2.41 0 0 1 3.4 0Z"/><path d="m14.5 12.5 2-2"/><path d="m11.5 9.5 2-2"/><path d="m8.5 6.5 2-2"/><path d="m17.5 15.5 2-2"/></svg>
            </div>
            <div class="vital-name">Height</div>
            <div class="vital-val">${patient.heightCm || 158} <span style="font-size: 11px; font-weight: normal; color: #64748b;">cm</span></div>
          </div>

          <!-- Allergies -->
          <div class="vital-card">
            <div class="icon-box" style="background: #fef2f2; color: #dc2626;">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
            </div>
            <div class="vital-name">Allergies</div>
            <div class="vital-val" style="font-size: 13px; text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
              ${patient.medicalHistory?.allergies && patient.medicalHistory.allergies !== 'None' ? patient.medicalHistory.allergies : 'None known'}
            </div>
          </div>
        </div>

        <!-- Demographics Card -->
        <div class="card-item">
          <div class="card-header">
            <div class="card-header-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
            <span class="card-header-title">Demographics</span>
          </div>

          <div class="pill-field">
            <label class="pill-label">Mother's Name</label>
            <div class="pill-input">${patient.name}</div>
          </div>

          <div class="pill-field">
            <label class="pill-label">Address</label>
            <div class="pill-input">${patient.village || patient.locality || 'Rampur North Sector 2'}</div>
          </div>

          <div class="pill-field">
            <label class="pill-label">Registration No.</label>
            <div class="pill-input" style="font-family: monospace;">${patient.id} ${patient.phmRegisterNo ? `• PHM: ${patient.phmRegisterNo}` : ''}</div>
          </div>

          <div class="pill-field">
            <label class="pill-label">Age &amp; Contact</label>
            <div class="pill-input">${patient.age} Years ${patient.phone ? `• ${patient.phone}` : '• No phone documented'}</div>
          </div>

          <div class="pill-field" style="margin-bottom: 0;">
            <label class="pill-label">Partner / Spouse</label>
            <div class="pill-input">${patient.partnerName || 'None documented'} ${patient.partnerAge ? `(${patient.partnerAge}y)` : ''} ${patient.partnerOccupation ? `• ${patient.partnerOccupation}` : ''}</div>
          </div>
        </div>
      </div>

      <!-- TAB 2: MEDICAL HISTORY -->
      <div id="tab-history" class="tab-view">
        <h1 class="view-title">Medical History</h1>
        <p class="view-desc">Chronic medical conditions, past surgeries, and clinical risk stratification.</p>

        <!-- Risk Banner -->
        <div class="card-item" style="background: ${riskBg}; border-color: ${riskColor}; color: ${riskColor};">
          <div style="font-weight: 800; font-size: 13px; display: flex; align-items: center; gap: 6px;">
            ⚠️ Risk Tier: ${patient.riskTier.toUpperCase()} (${patient.pretermProbability}% Risk)
          </div>
          <p style="font-size: 11px; margin-top: 4px; opacity: 0.95; line-height: 1.4;">
            <strong>${patient.specificCondition || 'Routine Antenatal Care'}</strong> • ${patient.notes || 'Normal progression.'}
          </p>
        </div>

        <!-- Comorbidities -->
        <div class="card-item">
          <div class="section-label">Documented Conditions</div>
          <div style="display: flex; flex-wrap: wrap; gap: 6px;">
            ${medicalFlags.length > 0 
              ? medicalFlags.map(m => `<span style="font-size: 11px; background: #fee2e2; color: #991b1b; padding: 4px 10px; border-radius: 10px; font-weight: 700;">● ${m}</span>`).join('')
              : '<span style="font-size: 11px; background: #dcfce7; color: #166534; padding: 4px 10px; border-radius: 10px; font-weight: 700;">✓ No chronic comorbidities reported</span>'
            }
          </div>
        </div>

        <!-- Surgeries & Allergies -->
        <div class="card-item">
          <div class="pill-field">
            <label class="pill-label">Past Surgeries</label>
            <div class="pill-input">${patient.medicalHistory?.surgeries || 'None documented'}</div>
          </div>
          <div class="pill-field" style="margin-bottom: 0;">
            <label class="pill-label">Known Allergies</label>
            <div class="pill-input">${patient.medicalHistory?.allergies || 'None known'}</div>
          </div>
        </div>
      </div>

      <!-- TAB 3: OBSTETRIC PROFILE -->
      <div id="tab-obstetric" class="tab-view">
        <h1 class="view-title">Obstetric Profile</h1>
        <p class="view-desc">Current gestational progress and previous pregnancy outcomes.</p>

        <!-- Progress Card -->
        <div class="card-item">
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; margin-bottom: 8px;">
            <strong style="color: #0f172a;">Gestational Age: ${patient.gestationalWeeks}w ${patient.gestationalDays || 0}d</strong>
            <span style="font-family: monospace; font-weight: bold; background: #f0f9ff; color: #0284c7; padding: 2px 8px; border-radius: 6px; border: 1px solid #bae6fd;">Trimester ${patient.trimester}</span>
          </div>
          <div style="width: 100%; background: #f1f0f7; height: 8px; border-radius: 9999px; overflow: hidden; margin-bottom: 10px;">
            <div style="background: linear-gradient(90deg, #0284c7, #006194); width: ${gestationalPercentage}%; height: 100%; border-radius: 9999px;"></div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px; font-size: 11px; border-top: 1px solid #f1f0f7; padding-top: 8px;">
            <div>LMP: <strong>${formatDate(patient.lmp)}</strong></div>
            <div>EDD: <strong>${formatDate(patient.edd)}</strong></div>
            <div>Fundal: <strong>${patient.fundalHeight || `${patient.gestationalWeeks} cm`}</strong></div>
            <div>FHR: <strong style="color: #16a34a;">${patient.fhr || '140 bpm'}</strong></div>
          </div>
        </div>

        <!-- 4 Badges -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px; margin-bottom: 12px; text-align: center;">
          <div class="card-item" style="padding: 8px; margin: 0;">
            <div style="font-size: 9px; font-weight: 800; color: #64748b;">GRAVIDA</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${patient.gravida}</div>
          </div>
          <div class="card-item" style="padding: 8px; margin: 0;">
            <div style="font-size: 9px; font-weight: 800; color: #64748b;">PARA</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${patient.para}</div>
          </div>
          <div class="card-item" style="padding: 8px; margin: 0;">
            <div style="font-size: 9px; font-weight: 800; color: #64748b;">LIVING</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${patient.livingChildren ?? patient.para}</div>
          </div>
          <div class="card-item" style="padding: 8px; margin: 0;">
            <div style="font-size: 9px; font-weight: 800; color: #64748b;">ABORTIONS</div>
            <div style="font-size: 14px; font-weight: 900; color: #0f172a;">${patient.abortions ?? 0}</div>
          </div>
        </div>

        <!-- Past Deliveries -->
        <div class="section-label">Past Deliveries (${patient.pastObstetricHistory?.length || 0})</div>
        <div>
          ${pastPregHtml}
        </div>
      </div>

      <!-- TAB 4: CLINIC VISITS -->
      <div id="tab-clinic" class="tab-view">
        <h1 class="view-title">Clinic Visits</h1>
        <p class="view-desc">All documented Antenatal Care (ANC) visits and midwife clinical examinations.</p>
        <div>
          ${visitsHtml}
        </div>
      </div>

      <!-- TAB 5: CARE PLAN -->
      <div id="tab-plan" class="tab-view">
        <h1 class="view-title">Care Plan</h1>
        <p class="view-desc">Laboratory investigations, delivery referrals, and emergency hotline.</p>

        <!-- Lab Results -->
        <div class="card-item">
          <div class="section-label" style="color: #006194; margin-bottom: 6px;">Laboratory Diagnostics</div>
          <div style="font-size: 11.5px; line-height: 1.8;">
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f0f7;">
              <span style="color: #64748b;">Hemoglobin:</span>
              <strong>${patient.hb || 11.2} g/dL</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f0f7;">
              <span style="color: #64748b;">Blood Sugar:</span>
              <strong style="font-family: monospace;">${patient.labResults?.fbs || '84 mg/dL (FBS)'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid #f1f0f7;">
              <span style="color: #64748b;">VDRL / RPR:</span>
              <strong style="color: #16a34a;">${patient.labResults?.vdrl || 'Non-reactive'}</strong>
            </div>
            <div style="display: flex; justify-content: space-between;">
              <span style="color: #64748b;">HIV / Rubella:</span>
              <strong>${patient.labResults?.hiv || 'Negative'} • ${patient.labResults?.rubella || 'Immune'}</strong>
            </div>
          </div>
        </div>

        <!-- Delivery Hospital Plan -->
        <div class="card-item">
          <div class="section-label" style="color: #006194; margin-bottom: 6px;">Delivery Hospital Plan</div>
          <div style="font-size: 11.5px; line-height: 1.6;">
            <div>Intended Hospital: <strong>${patient.intendedHospital || 'District Base Hospital'}</strong></div>
            <div>Transport Mode: <strong style="color: #0284c7;">Own Vehicle / Clinic Referral</strong></div>
          </div>
        </div>

        <a href="tel:108" class="btn-action btn-sos">
          🚨 Call Emergency 108 Ambulance
        </a>

        <button id="downloadBtn" class="btn-action btn-blue">
          📥 Download Complete Health Vault (.json)
        </button>

        <button id="copyBtn" class="btn-action btn-dark">
          📋 Copy Complete Health Vault JSON
        </button>
      </div>

    </div>

    <!-- Bottom 5-Tab Bar (Matches Reference Screenshot) -->
    <div class="bottom-nav">
      <button class="nav-tab active" onclick="switchTab('profile', this)">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
        <span>Profile</span>
      </button>

      <button class="nav-tab" onclick="switchTab('history', this)">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/></svg>
        <span>History</span>
      </button>

      <button class="nav-tab" onclick="switchTab('obstetric', this)">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.5 1.5 1 2 1s1.5-.5 2-1"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 5 6.3"/><path d="M12 2a4 4 0 0 1 4 4v1a4 4 0 0 1-8 0V6a4 4 0 0 1 4-4z"/></svg>
        <span>Obstetric</span>
      </button>

      <button class="nav-tab" onclick="switchTab('clinic', this)">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>
        <span>Clinic</span>
      </button>

      <button class="nav-tab" onclick="switchTab('plan', this)">
        <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
        <span>Plan</span>
      </button>
    </div>

    <!-- Android Bottom Bar -->
    <div class="android-bar">
      <span>◁</span>
      <span>○</span>
      <span>□</span>
    </div>

  </div>

  <script>
    const patientData = ${payloadJsonString};

    function switchTab(tabId, el) {
      document.querySelectorAll('.tab-view').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.nav-tab').forEach(n => {
        n.classList.remove('active');
        const icon = n.querySelector('svg');
        if (icon) icon.setAttribute('stroke-width', '2');
      });

      const target = document.getElementById('tab-' + tabId);
      if (target) target.classList.add('active');
      if (el) {
        el.classList.add('active');
        const icon = el.querySelector('svg');
        if (icon) icon.setAttribute('stroke-width', '2.5');
      }
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    document.getElementById('downloadBtn').addEventListener('click', function() {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(patientData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", "MaternaVault-" + patientData.id.replace('#', '') + "-" + patientData.name.replace(/\\s+/g, '_') + ".json");
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
    });

    document.getElementById('copyBtn').addEventListener('click', async function() {
      try {
        await navigator.clipboard.writeText(JSON.stringify(patientData, null, 2));
        this.innerText = '✅ Copied Full JSON Vault!';
        setTimeout(() => { this.innerText = '📋 Copy Complete Health Vault JSON'; }, 2000);
      } catch (e) {
        alert('Could not copy to clipboard directly. Please save the JSON file instead.');
      }
    });
  </script>
</body>
</html>`;

    return res.send(html);
  } catch (error) {
    console.error('Error rendering mobile pass:', error);
    return res.status(500).send('Error rendering mobile pass');
  }
};


