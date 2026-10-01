import { describe, it, expect } from 'vitest';
import { validateClinicalVitals, CLINICAL_BOUNDS } from '../utils/clinicalValidation';

describe('Web Clinical Range Validation (Sec 4.7.1, Table 4.4, TC-02)', () => {
  it('strictly blocks submission on physiological boundary violation: SBP = 260 mmHg (TC-02)', () => {
    const invalidVitals = {
      bpSystolic: 260, // Humanly impossible / lethal physiological limit violation
      bpDiastolic: 90,
      weightKg: 65,
      hb: 11.5,
    };

    const result = validateClinicalVitals(invalidVitals);

    expect(result.isValid).toBe(false);
    expect(result.errors.bpSystolic).toBeDefined();
    expect(result.errors.bpSystolic).toContain('260 mmHg');
    expect(result.errors.bpSystolic).toContain(`Table 4.4 physiological boundary (${CLINICAL_BOUNDS.SBP_MIN}–${CLINICAL_BOUNDS.SBP_MAX} mmHg)`);
  });

  it('strictly blocks submission when Diastolic BP violates boundary or exceeds Systolic BP', () => {
    // 1. DBP too high (>140 mmHg)
    const highDbp = validateClinicalVitals({
      bpSystolic: 180,
      bpDiastolic: 155,
    });
    expect(highDbp.isValid).toBe(false);
    expect(highDbp.errors.bpDiastolic).toContain('155 mmHg');

    // 2. SBP <= DBP
    const invertedBp = validateClinicalVitals({
      bpSystolic: 80,
      bpDiastolic: 120,
    });
    expect(invertedBp.isValid).toBe(false);
    expect(invertedBp.errors.bpSystolic).toContain('must be higher than Diastolic');
  });

  it('strictly blocks submission on implausible Hemoglobin values (Table 4.4)', () => {
    const tooLowHb = validateClinicalVitals({ hb: 1.8 });
    expect(tooLowHb.isValid).toBe(false);
    expect(tooLowHb.errors.hb).toContain('1.8 g/dL');

    const tooHighHb = validateClinicalVitals({ hb: 26.0 });
    expect(tooHighHb.isValid).toBe(false);
    expect(tooHighHb.errors.hb).toContain('26 g/dL');
  });

  it('strictly blocks submission on implausible Maternal Weight values (Table 4.4)', () => {
    const tooLowWeight = validateClinicalVitals({ weightKg: 22.0 });
    expect(tooLowWeight.isValid).toBe(false);
    expect(tooLowWeight.errors.weightKg).toContain('22 kg');

    const tooHighWeight = validateClinicalVitals({ weightKg: 275.0 });
    expect(tooHighWeight.isValid).toBe(false);
    expect(tooHighWeight.errors.weightKg).toContain('275 kg');
  });

  it('strictly blocks submission on implausible Fetal Heart Rate values (Table 4.4)', () => {
    const tooLowFhr = validateClinicalVitals({ fhr: '45 bpm' });
    expect(tooLowFhr.isValid).toBe(false);
    expect(tooLowFhr.errors.fhr).toContain('45 bpm');

    const tooHighFhr = validateClinicalVitals({ fhr: '255 bpm' });
    expect(tooHighFhr.isValid).toBe(false);
    expect(tooHighFhr.errors.fhr).toContain('255 bpm');
  });

  it('permits valid physiological clinical vitals within Table 4.4 boundaries', () => {
    const validVitals = {
      bpSystolic: 124,
      bpDiastolic: 82,
      weightKg: 64.5,
      heightCm: 158,
      hb: 11.2,
      fhr: '142 bpm',
      fundalHeight: '32 cm',
      bloodSugar: 94,
      temperature: 36.8,
      age: 27,
    };

    const result = validateClinicalVitals(validVitals);
    expect(result.isValid).toBe(true);
    expect(Object.keys(result.errors).length).toBe(0);
    expect(result.firstError).toBeUndefined();
  });
});
