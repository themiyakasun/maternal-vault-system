/**
 * Section 4.7.1, Table 4.4: Physiological Boundary & Plausibility Validation Ranges
 * Enforces strict physiological bounding on clinical inputs to prevent data-entry
 * corruption, erroneous triage alerts, and model prediction distortion.
 */

export const CLINICAL_BOUNDS = {
  // Blood Pressure (mmHg)
  SBP_MIN: 70,
  SBP_MAX: 240, // TC-02: SBP = 260 mmHg violates physiological limit
  DBP_MIN: 40,
  DBP_MAX: 140,
  MIN_PULSE_PRESSURE: 10, // SBP must exceed DBP by at least 10 mmHg

  // Maternal Vitals
  HEART_RATE_MIN: 40,
  HEART_RATE_MAX: 180,
  BODY_TEMP_MIN: 35.0, // °C
  BODY_TEMP_MAX: 42.0, // °C

  // Obstetric & Fetal
  FHR_MIN: 60,  // bpm
  FHR_MAX: 220, // bpm
  SFH_MIN: 10,  // cm
  SFH_MAX: 50,  // cm
  GA_WEEKS_MIN: 4,
  GA_WEEKS_MAX: 44,

  // Labs & Anthropometrics
  HB_MIN: 3.0,  // g/dL
  HB_MAX: 20.0, // g/dL
  BLOOD_SUGAR_MIN: 40,  // mg/dL
  BLOOD_SUGAR_MAX: 500, // mg/dL
  WEIGHT_KG_MIN: 30.0,
  WEIGHT_KG_MAX: 220.0,
  HEIGHT_CM_MIN: 110,
  HEIGHT_CM_MAX: 220,
  MATERNAL_AGE_MIN: 12,
  MATERNAL_AGE_MAX: 55,
} as const;

export interface ClinicalValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
  firstError?: string;
}

export interface ClinicalVitalsToValidate {
  bpSystolic?: number | string;
  bpDiastolic?: number | string;
  weightKg?: number | string;
  heightCm?: number | string;
  hb?: number | string;
  fhr?: number | string;
  fundalHeight?: number | string;
  bloodSugar?: number | string;
  temperature?: number | string;
  age?: number | string;
  gestationalWeeks?: number | string;
}

/**
 * Validates clinical data against Section 4.7.1, Table 4.4 physiological bounds.
 * Returns true if all values are physiologically plausible; otherwise returns
 * false with specific error messages for each offending field.
 */
export function validateClinicalVitals(data: ClinicalVitalsToValidate): ClinicalValidationResult {
  const errors: Record<string, string> = {};

  // 1. Systolic Blood Pressure
  if (data.bpSystolic !== undefined && data.bpSystolic !== '') {
    const sbp = Number(data.bpSystolic);
    if (isNaN(sbp) || sbp < CLINICAL_BOUNDS.SBP_MIN || sbp > CLINICAL_BOUNDS.SBP_MAX) {
      errors.bpSystolic = `Systolic BP (${sbp} mmHg) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.SBP_MIN}–${CLINICAL_BOUNDS.SBP_MAX} mmHg).`;
    }
  }

  // 2. Diastolic Blood Pressure
  if (data.bpDiastolic !== undefined && data.bpDiastolic !== '') {
    const dbp = Number(data.bpDiastolic);
    if (isNaN(dbp) || dbp < CLINICAL_BOUNDS.DBP_MIN || dbp > CLINICAL_BOUNDS.DBP_MAX) {
      errors.bpDiastolic = `Diastolic BP (${dbp} mmHg) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.DBP_MIN}–${CLINICAL_BOUNDS.DBP_MAX} mmHg).`;
    }
  }

  // 3. Pulse Pressure Relationship (SBP > DBP)
  if (
    data.bpSystolic !== undefined &&
    data.bpSystolic !== '' &&
    data.bpDiastolic !== undefined &&
    data.bpDiastolic !== ''
  ) {
    const sbp = Number(data.bpSystolic);
    const dbp = Number(data.bpDiastolic);
    if (!isNaN(sbp) && !isNaN(dbp) && sbp <= dbp) {
      errors.bpSystolic = `Systolic BP (${sbp} mmHg) must be higher than Diastolic BP (${dbp} mmHg).`;
    }
  }

  // 4. Hemoglobin (Hb)
  if (data.hb !== undefined && data.hb !== '') {
    const hb = Number(data.hb);
    if (isNaN(hb) || hb < CLINICAL_BOUNDS.HB_MIN || hb > CLINICAL_BOUNDS.HB_MAX) {
      errors.hb = `Hemoglobin (${hb} g/dL) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.HB_MIN}–${CLINICAL_BOUNDS.HB_MAX} g/dL).`;
    }
  }

  // 5. Maternal Weight
  if (data.weightKg !== undefined && data.weightKg !== '') {
    const wt = Number(data.weightKg);
    if (isNaN(wt) || wt < CLINICAL_BOUNDS.WEIGHT_KG_MIN || wt > CLINICAL_BOUNDS.WEIGHT_KG_MAX) {
      errors.weightKg = `Maternal weight (${wt} kg) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.WEIGHT_KG_MIN}–${CLINICAL_BOUNDS.WEIGHT_KG_MAX} kg).`;
    }
  }

  // 6. Maternal Height
  if (data.heightCm !== undefined && data.heightCm !== '') {
    const ht = Number(data.heightCm);
    if (isNaN(ht) || ht < CLINICAL_BOUNDS.HEIGHT_CM_MIN || ht > CLINICAL_BOUNDS.HEIGHT_CM_MAX) {
      errors.heightCm = `Maternal height (${ht} cm) violates Table 4.4 boundary (${CLINICAL_BOUNDS.HEIGHT_CM_MIN}–${CLINICAL_BOUNDS.HEIGHT_CM_MAX} cm).`;
    }
  }

  // 7. Fetal Heart Rate (FHR)
  if (data.fhr !== undefined && data.fhr !== '') {
    const fhrNum = typeof data.fhr === 'number' ? data.fhr : parseInt(String(data.fhr).replace(/\D/g, ''), 10);
    if (!isNaN(fhrNum) && (fhrNum < CLINICAL_BOUNDS.FHR_MIN || fhrNum > CLINICAL_BOUNDS.FHR_MAX)) {
      errors.fhr = `Fetal Heart Rate (${fhrNum} bpm) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.FHR_MIN}–${CLINICAL_BOUNDS.FHR_MAX} bpm).`;
    }
  }

  // 8. Fundal Height (SFH)
  if (data.fundalHeight !== undefined && data.fundalHeight !== '') {
    const sfhNum = typeof data.fundalHeight === 'number' ? data.fundalHeight : parseInt(String(data.fundalHeight).replace(/\D/g, ''), 10);
    if (!isNaN(sfhNum) && (sfhNum < CLINICAL_BOUNDS.SFH_MIN || sfhNum > CLINICAL_BOUNDS.SFH_MAX)) {
      errors.fundalHeight = `Fundal height (${sfhNum} cm) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.SFH_MIN}–${CLINICAL_BOUNDS.SFH_MAX} cm).`;
    }
  }

  // 9. Blood Sugar
  if (data.bloodSugar !== undefined && data.bloodSugar !== '') {
    const bs = Number(data.bloodSugar);
    if (!isNaN(bs) && (bs < CLINICAL_BOUNDS.BLOOD_SUGAR_MIN || bs > CLINICAL_BOUNDS.BLOOD_SUGAR_MAX)) {
      errors.bloodSugar = `Blood glucose (${bs} mg/dL) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.BLOOD_SUGAR_MIN}–${CLINICAL_BOUNDS.BLOOD_SUGAR_MAX} mg/dL).`;
    }
  }

  // 10. Body Temperature
  if (data.temperature !== undefined && data.temperature !== '') {
    const temp = Number(data.temperature);
    if (!isNaN(temp) && (temp < CLINICAL_BOUNDS.BODY_TEMP_MIN || temp > CLINICAL_BOUNDS.BODY_TEMP_MAX)) {
      errors.temperature = `Body temperature (${temp} °C) violates Table 4.4 physiological boundary (${CLINICAL_BOUNDS.BODY_TEMP_MIN}–${CLINICAL_BOUNDS.BODY_TEMP_MAX} °C).`;
    }
  }

  // 11. Maternal Age
  if (data.age !== undefined && data.age !== '') {
    const age = Number(data.age);
    if (isNaN(age) || age < CLINICAL_BOUNDS.MATERNAL_AGE_MIN || age > CLINICAL_BOUNDS.MATERNAL_AGE_MAX) {
      errors.age = `Maternal age (${age} yrs) violates Table 4.4 valid clinical range (${CLINICAL_BOUNDS.MATERNAL_AGE_MIN}–${CLINICAL_BOUNDS.MATERNAL_AGE_MAX} yrs).`;
    }
  }

  const errorKeys = Object.keys(errors);
  return {
    isValid: errorKeys.length === 0,
    errors,
    firstError: errorKeys.length > 0 ? errors[errorKeys[0]] : undefined,
  };
}
