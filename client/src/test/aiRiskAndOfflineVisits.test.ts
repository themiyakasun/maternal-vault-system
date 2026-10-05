import { describe, it, expect, beforeEach } from 'vitest';
import { evaluateVisitRisk, getPatientEffectiveRisk, calculateNextVisitProgression } from '../utils/aiRiskCalculator';
import { mergeVisits, offlineStorage } from '../services/offlineStorage';
import type { Patient, ANCVisit } from '../types/triage';

describe('AI Stratified Risk Level & Offline Multi-Visit Retention', () => {
  const basePatient: Patient = {
    id: '#9901',
    name: 'Dilini Perera',
    initials: 'DP',
    age: 28,
    gravida: 2,
    para: 1,
    gestationalWeeks: 24,
    gestationalDays: 2,
    trimester: 2,
    bpSystolic: 118,
    bpDiastolic: 76,
    isBpAlert: false,
    bmi: 22.4,
    bmiCategory: 'Normal',
    riskTier: 'low',
    riskTitle: 'LOW RISK',
    riskSubtitle: 'Intake Baseline Assessment',
    pretermProbability: 8,
    featureWeights: [],
    clinicId: 'clinic-test-01',
    tenantId: 'clinic-test-01',
    ancVisits: [],
  };

  describe('1. AI Stratified Risk Level Resolution', () => {
    it('should evaluate low risk for optimal clinic visit vitals', () => {
      const lowVisit: ANCVisit = {
        visitNo: 1,
        date: '2026-09-10',
        poa: '20w 0d',
        weightKg: 58.5,
        bp: '116/76',
        sfhCm: '20 cm',
        presentation: 'Cephalic',
        engagement: 'Not engaged',
        fhr: '140 bpm',
        fm: 'Active (>10/12h)',
        urineAlb: 'Nil',
        urineSug: 'Nil',
        edema: 'Nil',
        examiner: 'Priya Sharma, PHM',
        remarks: 'Optimal progression.',
      };

      const risk = evaluateVisitRisk(lowVisit, basePatient);
      expect(risk.riskTier).toBe('low');
      expect(risk.riskTitle).toBe('LOW RISK');
      expect(risk.isBpAlert).toBe(false);
    });

    it('should evaluate moderate risk for pre-hypertension and pedal edema', () => {
      const modVisit: ANCVisit = {
        visitNo: 2,
        date: '2026-09-24',
        poa: '22w 0d',
        weightKg: 61.0,
        bp: '134/86',
        sfhCm: '22 cm',
        presentation: 'Cephalic',
        engagement: 'Not engaged',
        fhr: '144 bpm',
        fm: 'Active (>10/12h)',
        urineAlb: 'Trace',
        urineSug: 'Nil',
        edema: '+ (Pedal)',
        examiner: 'Priya Sharma, PHM',
        remarks: 'Mild pedal edema noted.',
      };

      const risk = evaluateVisitRisk(modVisit, basePatient);
      expect(risk.riskTier).toBe('moderate');
      expect(risk.riskTitle).toBe('MODERATE RISK');
    });

    it('should evaluate high risk for severe gestational hypertension & proteinuria', () => {
      const highVisit: ANCVisit = {
        visitNo: 3,
        date: '2026-10-01',
        poa: '24w 0d',
        weightKg: 64.0,
        bp: '150/98',
        sfhCm: '24 cm',
        presentation: 'Cephalic',
        engagement: 'Not engaged',
        fhr: '156 bpm',
        fm: 'Reduced (<10/12h)',
        urineAlb: '2+',
        urineSug: 'Nil',
        edema: 'Generalized (++)',
        examiner: 'Priya Sharma, PHM',
        remarks: 'Severe headache and blurred vision.',
      };

      const risk = evaluateVisitRisk(highVisit, basePatient);
      expect(risk.riskTier).toBe('high');
      expect(risk.riskTitle).toBe('HIGH RISK');
      expect(risk.isBpAlert).toBe(true);
      expect(risk.pretermProbability).toBeGreaterThanOrEqual(60);
    });

    it('should dynamically set patient effective risk to their LATEST visit prediction', () => {
      const patientWithVisits: Patient = {
        ...basePatient,
        ancVisits: [
          {
            visitNo: 1,
            date: '2026-08-01',
            poa: '14w 0d',
            weightKg: 56.0,
            bp: '116/74',
            sfhCm: '14 cm',
            presentation: 'Cephalic',
            engagement: 'Not engaged',
            fhr: '138 bpm',
            fm: 'Active',
            urineAlb: 'Nil',
            urineSug: 'Nil',
            edema: 'Nil',
            examiner: 'PHM',
            remarks: 'Booking visit',
          },
          {
            visitNo: 2,
            date: '2026-09-01',
            poa: '18w 0d',
            weightKg: 58.0,
            bp: '132/86',
            sfhCm: '18 cm',
            presentation: 'Cephalic',
            engagement: 'Not engaged',
            fhr: '142 bpm',
            fm: 'Active',
            urineAlb: 'Trace',
            urineSug: 'Nil',
            edema: 'Nil',
            examiner: 'PHM',
            remarks: 'Pre-hypertension',
          },
          {
            visitNo: 3,
            date: '2026-10-01',
            poa: '22w 0d',
            weightKg: 61.5,
            bp: '150/98',
            sfhCm: '22 cm',
            presentation: 'Cephalic',
            engagement: 'Not engaged',
            fhr: '154 bpm',
            fm: 'Reduced',
            urineAlb: '2+',
            urineSug: 'Nil',
            edema: 'Generalized',
            examiner: 'PHM',
            remarks: 'Headache and 2+ proteinuria',
          },
        ],
      };

      const effectiveRisk = getPatientEffectiveRisk(patientWithVisits);
      expect(effectiveRisk.riskTier).toBe('high');
      expect(effectiveRisk.sourceVisitNo).toBe(3);
      expect(effectiveRisk.riskSubtitle).toContain('Visit #3');
      expect(effectiveRisk.riskSubtitle).toContain('Pre-eclampsia Alert');
    });
  });

  describe('2. Offline Multi-Visit Retention & Reconciliation', () => {
    beforeEach(() => {
      offlineStorage.clearQueue('clinic-test-01');
    });

    it('should retain all 4 visits added offline in the mutation queue without overwriting', async () => {
      const patientId = 'PT-7701';
      const clinicId = 'clinic-test-01';

      // Midwife adds 4 separate visits offline
      const id1 = await offlineStorage.enqueueMutation({
        type: 'ADD_VISIT',
        clinicId,
        patientId,
        payload: { date: '2026-10-01', weightKg: 58, bpSystolic: 118, bpDiastolic: 76, sfhCm: '20 cm' },
      });

      const id2 = await offlineStorage.enqueueMutation({
        type: 'ADD_VISIT',
        clinicId,
        patientId,
        payload: { date: '2026-10-08', weightKg: 59, bpSystolic: 122, bpDiastolic: 78, sfhCm: '21 cm' },
      });

      const id3 = await offlineStorage.enqueueMutation({
        type: 'ADD_VISIT',
        clinicId,
        patientId,
        payload: { date: '2026-10-15', weightKg: 60, bpSystolic: 134, bpDiastolic: 86, sfhCm: '22 cm' },
      });

      const id4 = await offlineStorage.enqueueMutation({
        type: 'ADD_VISIT',
        clinicId,
        patientId,
        payload: { date: '2026-10-22', weightKg: 62, bpSystolic: 150, bpDiastolic: 98, sfhCm: '23 cm' },
      });

      const queue = offlineStorage.getOfflineQueue(clinicId);
      const visitMutations = queue.filter((m) => m.patientId === patientId && m.type === 'ADD_VISIT');

      // Crucial assertion: All 4 mutations must exist!
      expect(visitMutations.length).toBe(4);
      expect(visitMutations.map((m) => m.id)).toEqual([id1, id2, id3, id4]);
    });

    it('should merge server and local visits without losing offline visits', () => {
      const serverVisits: ANCVisit[] = [
        {
          visitNo: 1,
          date: '2026-08-01',
          poa: '12w 0d',
          weightKg: 55,
          bp: '116/74',
          sfhCm: '12 cm',
          presentation: 'Cephalic',
          engagement: 'Not engaged',
          fhr: '140 bpm',
          fm: 'Active',
          urineAlb: 'Nil',
          urineSug: 'Nil',
          edema: 'Nil',
          examiner: 'PHM',
          remarks: 'Intake visit',
        },
      ];

      const localVisits: ANCVisit[] = [
        ...serverVisits,
        {
          visitNo: 2,
          date: '2026-08-20',
          poa: '15w 0d',
          weightKg: 57,
          bp: '118/76',
          sfhCm: '15 cm',
          presentation: 'Cephalic',
          engagement: 'Not engaged',
          fhr: '140 bpm',
          fm: 'Active',
          urineAlb: 'Nil',
          urineSug: 'Nil',
          edema: 'Nil',
          examiner: 'PHM',
          remarks: 'Offline Visit 2',
        },
        {
          visitNo: 3,
          date: '2026-09-10',
          poa: '18w 0d',
          weightKg: 59,
          bp: '124/80',
          sfhCm: '18 cm',
          presentation: 'Cephalic',
          engagement: 'Not engaged',
          fhr: '142 bpm',
          fm: 'Active',
          urineAlb: 'Nil',
          urineSug: 'Nil',
          edema: 'Nil',
          examiner: 'PHM',
          remarks: 'Offline Visit 3',
        },
        {
          visitNo: 4,
          date: '2026-09-30',
          poa: '21w 0d',
          weightKg: 61,
          bp: '134/86',
          sfhCm: '21 cm',
          presentation: 'Cephalic',
          engagement: 'Not engaged',
          fhr: '144 bpm',
          fm: 'Active',
          urineAlb: 'Trace',
          urineSug: 'Nil',
          edema: '+',
          examiner: 'PHM',
          remarks: 'Offline Visit 4',
        },
        {
          visitNo: 5,
          date: '2026-10-15',
          poa: '23w 0d',
          weightKg: 63,
          bp: '150/98',
          sfhCm: '23 cm',
          presentation: 'Cephalic',
          engagement: 'Not engaged',
          fhr: '152 bpm',
          fm: 'Reduced',
          urineAlb: '2+',
          urineSug: 'Nil',
          edema: '++',
          examiner: 'PHM',
          remarks: 'Offline Visit 5 (High Risk)',
        },
      ];

      const merged = mergeVisits(serverVisits, localVisits);

      // Verify all 5 visits are retained
      expect(merged.length).toBe(5);
      expect(merged[0].visitNo).toBe(1);
      expect(merged[4].visitNo).toBe(5);
      expect(merged[4].bp).toBe('150/98');
    });
  });

  describe('3. Clinic Visit Auto-Progression & Duplicate Prevention', () => {
    it('should auto-advance date, gestational weeks, SFH, and weight for low risk progression', () => {
      const patient: Patient = {
        ...basePatient,
        gestationalWeeks: 24,
        gestationalDays: 0,
        weightKg: 55.0,
        ancVisits: [
          {
            visitNo: 1,
            date: '2026-08-01',
            poa: '20w 0d',
            gestationalWeeks: 20,
            gestationalDays: 0,
            weightKg: 53.0,
            bp: '116/76',
            sfhCm: '20 cm',
            presentation: 'Cephalic',
            engagement: 'Not engaged',
            fhr: '140 bpm',
            fm: 'Active',
            urineAlb: 'Nil',
            urineSug: 'Nil',
            edema: 'Nil',
            examiner: 'PHM',
            remarks: 'Booking visit',
          },
        ],
      };

      const prog = calculateNextVisitProgression(patient, 'low');
      expect(prog.date).toBe('2026-08-29'); // +28 days from 2026-08-01
      expect(prog.gestationalWeeks).toBe(24); // 20w + 4w
      expect(prog.sfhCm).toBe('24');
      expect(parseFloat(prog.weightKg)).toBeGreaterThan(53.0);
      expect(prog.bpSystolic).toBe('116');
      expect(prog.bpDiastolic).toBe('76');
      expect(prog.urineAlb).toBe('Nil');
    });

    it('should advance with 14-day intervals and pre-eclampsia vitals for high risk progression', () => {
      const patient: Patient = {
        ...basePatient,
        gestationalWeeks: 30,
        gestationalDays: 0,
        ancVisits: [
          {
            visitNo: 1,
            date: '2026-08-01',
            poa: '28w 0d',
            gestationalWeeks: 28,
            gestationalDays: 0,
            weightKg: 60.0,
            bp: '120/80',
            sfhCm: '28 cm',
            presentation: 'Cephalic',
            engagement: 'Not engaged',
            fhr: '140 bpm',
            fm: 'Active',
            urineAlb: 'Nil',
            urineSug: 'Nil',
            edema: 'Nil',
            examiner: 'PHM',
            remarks: 'Normal visit',
          },
        ],
      };

      const prog = calculateNextVisitProgression(patient, 'high');
      expect(prog.date).toBe('2026-08-15'); // +14 days for high-risk monitoring
      expect(prog.gestationalWeeks).toBe(30); // 28w + 2w
      expect(prog.bpSystolic).toBe('150');
      expect(prog.bpDiastolic).toBe('98');
      expect(prog.urineAlb).toBe('2+');
      expect(prog.edema).toContain('Generalized');
      expect(prog.fm).toContain('Reduced');
    });

    it('should automatically skip existing dates to guarantee no duplicate visit dates', () => {
      const patient: Patient = {
        ...basePatient,
        gestationalWeeks: 28,
        ancVisits: [
          {
            visitNo: 1,
            date: '2026-08-01',
            poa: '24w 0d',
            gestationalWeeks: 24,
            gestationalDays: 0,
            weightKg: 55.0,
            bp: '116/76',
            sfhCm: '24 cm',
            presentation: 'Cephalic',
            engagement: 'Not engaged',
            fhr: '140 bpm',
            fm: 'Active',
            urineAlb: 'Nil',
            urineSug: 'Nil',
            edema: 'Nil',
            examiner: 'PHM',
            remarks: 'Visit 1',
          },
          {
            visitNo: 2,
            date: '2026-08-29', // Intended next visit date (+28 days) already taken!
            poa: '28w 0d',
            gestationalWeeks: 28,
            gestationalDays: 0,
            weightKg: 56.5,
            bp: '120/80',
            sfhCm: '28 cm',
            presentation: 'Cephalic',
            engagement: 'Not engaged',
            fhr: '140 bpm',
            fm: 'Active',
            urineAlb: 'Nil',
            urineSug: 'Nil',
            edema: 'Nil',
            examiner: 'PHM',
            remarks: 'Visit 2',
          },
        ],
      };

      const prog = calculateNextVisitProgression(patient, 'low');
      // Should not be 2026-08-29 since it's already recorded
      expect(prog.date).not.toBe('2026-08-29');
      expect(prog.date).not.toBe('2026-08-01');
      // Advances by 21 days from visit 2 (2026-08-29 + 21 days = 2026-09-19)
      expect(prog.date).toBe('2026-09-19');
      expect(prog.gestationalWeeks).toBe(31);
    });

    it('should sequentially generate 3 unique progressive visits without date conflict', () => {
      let patient: Patient = {
        ...basePatient,
        recordDate: '2026-06-01',
        gestationalWeeks: 20,
        weightKg: 52.0,
        ancVisits: [],
      };

      const visitDates: string[] = [];

      for (let i = 1; i <= 3; i++) {
        const prog = calculateNextVisitProgression(patient, 'low');
        expect(visitDates).not.toContain(prog.date);
        visitDates.push(prog.date);

        const newVisit: ANCVisit = {
          visitNo: i,
          date: prog.date,
          poa: `${prog.gestationalWeeks}w ${prog.gestationalDays}d`,
          gestationalWeeks: prog.gestationalWeeks,
          gestationalDays: prog.gestationalDays,
          weightKg: parseFloat(prog.weightKg),
          bp: `${prog.bpSystolic}/${prog.bpDiastolic}`,
          sfhCm: `${prog.sfhCm} cm`,
          presentation: prog.presentation,
          engagement: prog.engagement,
          fhr: `${prog.fhr} bpm`,
          fm: prog.fm,
          urineAlb: prog.urineAlb,
          urineSug: prog.urineSug,
          edema: prog.edema,
          examiner: 'PHM Lead',
          remarks: prog.remarks,
        };

        patient = {
          ...patient,
          gestationalWeeks: prog.gestationalWeeks,
          weightKg: parseFloat(prog.weightKg),
          ancVisits: [...(patient.ancVisits || []), newVisit],
        };
      }

      expect(visitDates.length).toBe(3);
      // All dates are strictly unique
      const uniqueDates = new Set(visitDates);
      expect(uniqueDates.size).toBe(3);
      // Visits progress forward in time
      expect(new Date(visitDates[0]).getTime()).toBeLessThan(new Date(visitDates[1]).getTime());
      expect(new Date(visitDates[1]).getTime()).toBeLessThan(new Date(visitDates[2]).getTime());
    });
  });
});
