import { describe, it } from 'node:test';
import assert from 'node:assert';
import { evaluatePatientRisk } from '../src/services/mlRiskService.js';

describe('4. ML Risk Stratification & Clinical Evaluation', () => {
  it('correctly classifies high risk for stage 2 hypertension (BP >= 140/90)', async () => {
    const risk = await evaluatePatientRisk({
      age: 26,
      bpSystolic: 145,
      bpDiastolic: 95,
      gestationalWeeks: 28,
      hb: 11.5,
      bmi: 23.0,
    });

    assert.strictEqual(risk.overallRiskTier, 'high');
    assert.strictEqual(risk.isBpAlert, true);
    assert.strictEqual(risk.riskTitle, 'HIGH RISK');
    assert.ok(
      risk.pretermProbability >= 50,
      'High risk should have elevated preterm probability',
    );
  });

  it('correctly classifies moderate risk for gestational anemia (Hb < 10.5)', async () => {
    const risk = await evaluatePatientRisk({
      age: 24,
      bpSystolic: 115,
      bpDiastolic: 75,
      gestationalWeeks: 20,
      hb: 9.8, // Anemia
      bmi: 22.0,
    });

    assert.strictEqual(risk.overallRiskTier, 'moderate');
    assert.strictEqual(risk.isBpAlert, false);
    assert.ok(
      risk.riskSubtitle.includes('Anemia') || risk.riskSubtitle.includes('Hb'),
    );
  });

  it('correctly classifies low risk for normal healthy maternal vitals', async () => {
    const risk = await evaluatePatientRisk({
      age: 25,
      bpSystolic: 118,
      bpDiastolic: 76,
      gestationalWeeks: 16,
      hb: 12.0,
      bmi: 21.5,
    });

    assert.strictEqual(risk.overallRiskTier, 'low');
    assert.strictEqual(risk.isBpAlert, false);
    assert.strictEqual(risk.riskTitle, 'LOW RISK');
  });
});
