import { describe, it } from 'node:test';
import assert from 'node:assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildMobilePayload,
  compressVaultForQR,
} from '../src/controllers/patientController.js';
import type { Patient } from '../src/types/patient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mockPatient: Patient = {
  id: '#1001',
  name: 'Anula Kumari',
  initials: 'AK',
  initialsColor: 'bg-[#fee2e2]',
  age: 28,
  gravida: 2,
  para: 1,
  gestationalWeeks: 32,
  gestationalDays: 2,
  trimester: 3,
  bpSystolic: 142,
  bpDiastolic: 92,
  isBpAlert: true,
  bmi: 27.4,
  bmiCategory: 'Overweight',
  bmiStatusClass: 'warning',
  riskTier: 'high',
  riskTitle: 'HIGH RISK',
  riskSubtitle: 'Gestational HTN',
  pretermProbability: 62,
  alertHeadline: 'High Risk Alert',
  alertDetails: 'Blood pressure elevated',
  featureWeights: [],
  notes: 'Requires weekly blood pressure monitoring.',
  village: 'Rampur North',
  locality: 'Sector 2',
  tenantId: 'clinic-4b-rampur',
  clinicId: 'clinic-4b-rampur',
  abhaId: '91-9988-7766-5544',
  edd: '15 Oct 2026',
  fundalHeight: '32 cm',
  isFundalAlert: false,
  hb: 10.1,
  isHbAlert: false,
  fhr: '144 bpm',
  isFhrAlert: false,
  syncStatus: 'synced-p2p',
  assessedBy: 'Priya Sharma, PHM',
  assessedTime: '10:30 AM',
  assessedLocation: 'Sub-center Rampur',
  specificCondition: 'Gestational Hypertension',
  phone: '+94 77 123 4567',
  nicNo: '958123456V',
  livingChildren: 1,
  abortions: 0,
  registrationDate: '2026-03-01',
  bloodGroup: 'B +ve',
  lmp: '2026-01-08',
  poaAtBooking: '8w',
  ancVisits: [
    {
      visitNo: 1,
      date: '2026-03-10',
      poa: '12w',
      weightKg: 58.5,
      bp: '118/76',
      sfhCm: '12 cm',
      presentation: 'Cephalic',
      engagement: 'Not engaged',
      fhr: '142 bpm',
      fm: 'Active',
      urineAlb: 'Nil',
      urineSug: 'Nil',
      edema: 'Nil',
      examiner: 'Priya Sharma, PHM',
      remarks: 'Normal baseline visit',
    },
  ],
};

describe('5. Architecture Conformance: Complete Absence of HL7 FHIR, LOINC, and UCUM', () => {
  it('confirms absence of HL7 FHIR R4 transformers in server source code', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => f.endsWith('.ts') && !f.includes('schemaConformance.test.ts'));

    for (const file of tsFiles) {
      const filePath = path.join(srcDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.strictEqual(content.includes('http://hl7.org/fhir'), false, `Found FHIR URL in ${file}`);
      assert.strictEqual(content.includes('resourceType: "Bundle"'), false, `Found FHIR Bundle in ${file}`);
      assert.strictEqual(content.includes('resourceType: "Observation"'), false, `Found FHIR Observation in ${file}`);
    }
  });

  it('confirms zero LOINC clinical coding systems in server source code and database models', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => f.endsWith('.ts') && !f.includes('schemaConformance.test.ts'));

    for (const file of tsFiles) {
      const filePath = path.join(srcDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.strictEqual(content.includes('http://loinc.org'), false, `Found LOINC URL in ${file}`);
      assert.strictEqual(content.toLowerCase().includes('loinc'), false, `Found LOINC mention in ${file}`);
    }
  });

  it('confirms zero UCUM units systems and formats in server source code', () => {
    const srcDir = path.resolve(__dirname, '../src');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => f.endsWith('.ts') && !f.includes('schemaConformance.test.ts'));

    for (const file of tsFiles) {
      const filePath = path.join(srcDir, file);
      const content = fs.readFileSync(filePath, 'utf-8');
      assert.strictEqual(content.includes('http://unitsofmeasure.org'), false, `Found UCUM URL in ${file}`);
      assert.strictEqual(content.includes('mm[Hg]'), false, `Found UCUM mm[Hg] in ${file}`);
      assert.strictEqual(content.includes('{beats}/min'), false, `Found UCUM {beats}/min in ${file}`);
    }
  });

  it('verifies server QR and mobile payloads conform strictly to compact MaternaVault schema', () => {
    const mobilePayload = buildMobilePayload(mockPatient);
    const compactQRPayload = compressVaultForQR(mobilePayload);
    const jsonStr = JSON.stringify(compactQRPayload);

    // Verify compact native schema properties
    assert.strictEqual(compactQRPayload.id, '#1001');
    assert.strictEqual(compactQRPayload.n, 'Anula Kumari');
    assert.strictEqual(compactQRPayload.bp, '142/92');

    // Verify complete absence of FHIR, LOINC, and UCUM in generated payload
    assert.strictEqual(jsonStr.includes('resourceType'), false);
    assert.strictEqual(jsonStr.includes('http://hl7.org/fhir'), false);
    assert.strictEqual(jsonStr.includes('http://loinc.org'), false);
    assert.strictEqual(jsonStr.toLowerCase().includes('loinc'), false);
    assert.strictEqual(jsonStr.includes('http://unitsofmeasure.org'), false);
    assert.strictEqual(jsonStr.includes('mm[Hg]'), false);
    assert.strictEqual(jsonStr.includes('{beats}/min'), false);
  });
});
