import { describe, it } from 'node:test';
import assert from 'node:assert';
import { localEncryptedDb } from '../src/db/localEncryptedDb.js';
import type { Patient } from '../src/types/patient.js';

describe('2. Patient Records & Encrypted Database', () => {
  const testPatientId = '#9999';

  it('should fetch all patients from the local encrypted database', () => {
    const result = localEncryptedDb.getAll({ limit: 10, offset: 0 });
    assert.ok(Array.isArray(result.data), 'Data must be an array');
    assert.ok(result.total >= 0, 'Total count must be valid');
  });

  it('should insert a new maternal patient into AES-256-GCM storage', () => {
    const newPatient: Patient = {
      id: testPatientId,
      name: 'Sunethra Wickramasinghe',
      initials: 'SW',
      initialsColor: 'bg-[#d1fae5] text-[#065f46]',
      age: 27,
      gravida: 2,
      para: 1,
      gestationalWeeks: 24,
      gestationalDays: 3,
      trimester: 2,
      bpSystolic: 118,
      bpDiastolic: 76,
      isBpAlert: false,
      bmi: 23.1,
      bmiCategory: 'Normal',
      bmiStatusClass: 'normal',
      riskTier: 'low',
      riskTitle: 'LOW RISK',
      riskSubtitle: 'Routine Antenatal Progression',
      pretermProbability: 8,
      alertHeadline: 'Routine',
      alertDetails: 'Normal pregnancy',
      featureWeights: [],
      notes: 'Initial booking visit complete.',
      village: 'Sector 4',
      locality: 'Rampur',
      tenantId: 'clinic-4b-rampur',
      clinicId: 'clinic-4b-rampur',
      abhaId: '91-4432-1120-9901',
      edd: '2026-11-20',
      fundalHeight: '24 cm',
      isFundalAlert: false,
      hb: 11.8,
      isHbAlert: false,
      fhr: '142 bpm',
      isFhrAlert: false,
      syncStatus: 'updated-local',
      syncNode: 'Local Encrypted Station',
      syncProtocol: 'SQLite / AES-256-GCM',
      assessedBy: 'Priya Sharma, PHM',
      assessedTime: 'Today',
      assessedLocation: 'Sub-center Rampur',
      specificCondition: 'Routine Antenatal',
      registrationDate: '2026-03-10',
      bloodGroup: 'B +ve',
      ancVisits: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    localEncryptedDb.insert(newPatient);
    const retrieved = localEncryptedDb.getById(testPatientId);
    assert.ok(retrieved, 'Patient should be retrieved from encrypted DB');
    assert.strictEqual(retrieved?.name, 'Sunethra Wickramasinghe');
    assert.strictEqual(retrieved?.bpSystolic, 118);
  });

  it('should append an Antenatal Clinic (ANC) visit and update vitals', () => {
    const visitResult = localEncryptedDb.addClinicVisit(testPatientId, {
      poa: '28w 0d',
      weightKg: 64.5,
      bpSystolic: 122,
      bpDiastolic: 78,
      sfhCm: '28 cm',
      fhr: '144 bpm',
      presentation: 'Cephalic',
      urineAlb: 'Nil',
      urineSug: 'Nil',
      fm: 'Active (>10/12h)',
      edema: 'Nil',
      examiner: 'Sister Priya Sharma',
      remarks: 'Fetal growth on track',
    });

    assert.ok(visitResult, 'Visit should be recorded');
    assert.strictEqual(visitResult?.visit.visitNo, 1);
    assert.strictEqual(visitResult?.patient.weightKg, 64.5);
    assert.strictEqual(visitResult?.patient.bpSystolic, 122);
  });

  it('should aggregate clinical statistics across registered patients', () => {
    const stats = localEncryptedDb.getStats('clinic-4b-rampur');
    assert.ok(
      stats.totalRegistered > 0,
      'Total registered patients count should be > 0',
    );
    assert.ok(typeof stats.highRiskCount === 'number');
    assert.ok(typeof stats.moderateRiskCount === 'number');
    assert.ok(typeof stats.lowRiskCount === 'number');
  });

  it('should delete a patient record cleanly', () => {
    const deleted = localEncryptedDb.delete(testPatientId);
    assert.strictEqual(deleted, true);
    const checkDeleted = localEncryptedDb.getById(testPatientId);
    assert.strictEqual(
      checkDeleted,
      undefined,
      'Deleted patient must return undefined',
    );
  });
});
