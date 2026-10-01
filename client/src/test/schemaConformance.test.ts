import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { buildCompletePatientVaultJSON } from '../components/Modals/PatientQRModal';
import type { Patient } from '../types/triage';

const mockPatient: Patient = {
  id: '#1001',
  name: 'Anula Kumari',
  initials: 'AK',
  initialsColor: 'bg-rose-100 text-rose-700',
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
  alertDetails: 'Elevated BP',
  featureWeights: [],
  village: 'Rampur North',
  locality: 'Sector 2',
  tenantId: 'clinic-4b-rampur',
  clinicId: 'clinic-4b-rampur',
  abhaId: '91-9988-7766-5544',
  edd: '2026-10-15',
  hb: 10.1,
  isHbAlert: false,
  fhr: '144 bpm',
  isFhrAlert: false,
  syncStatus: 'synced-p2p',
  assessedBy: 'Priya Sharma, PHM',
};

describe('Architecture Conformance: Absence of HL7 FHIR, LOINC, and UCUM in Client', () => {
  it('confirms zero HL7 FHIR R4 schema transformers exist in client source files', () => {
    const srcDir = path.resolve(__dirname, '../');
    const fhirTransformerFile = path.join(srcDir, 'utils/fhirSerializer.ts');
    expect(fs.existsSync(fhirTransformerFile)).toBe(false);

    // Scan all client source files for forbidden FHIR systems or transformers
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('schemaConformance.test.ts'));

    for (const file of tsFiles) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      expect(content).not.toContain('http://hl7.org/fhir');
      expect(content).not.toContain('resourceType:');
      expect(content).not.toContain('Bundle');
    }
  });

  it('confirms zero LOINC clinical coding references in client source files and schemas', () => {
    const srcDir = path.resolve(__dirname, '../');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('schemaConformance.test.ts'));

    for (const file of tsFiles) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      expect(content).not.toContain('http://loinc.org');
      expect(content.toLowerCase()).not.toContain('loinc');
    }
  });

  it('confirms zero UCUM units of measure coding systems in client source files', () => {
    const srcDir = path.resolve(__dirname, '../');
    const files = fs.readdirSync(srcDir, { recursive: true }) as string[];
    const tsFiles = files.filter(f => (f.endsWith('.ts') || f.endsWith('.tsx')) && !f.includes('schemaConformance.test.ts'));

    for (const file of tsFiles) {
      const content = fs.readFileSync(path.join(srcDir, file), 'utf-8');
      expect(content).not.toContain('http://unitsofmeasure.org');
      // Verify no UCUM-bracketed unit codes exist in client code
      expect(content).not.toContain('mm[Hg]');
      expect(content).not.toContain('{beats}/min');
    }
  });

  it('verifies generated patient JSON strictly conforms to native MaternaVault schema', () => {
    const json = buildCompletePatientVaultJSON(mockPatient);
    const jsonString = JSON.stringify(json);

    // Must be MaternaVault native
    expect(json.app).toBe('MaternaVault');
    expect(json.ver).toBe('1.2.0');

    // Absence of FHIR structure
    expect(jsonString).not.toContain('resourceType');
    expect(jsonString).not.toContain('http://hl7.org/fhir');

    // Absence of LOINC
    expect(jsonString).not.toContain('http://loinc.org');
    expect(jsonString.toLowerCase()).not.toContain('loinc');

    // Absence of UCUM
    expect(jsonString).not.toContain('http://unitsofmeasure.org');
    expect(jsonString).not.toContain('mm[Hg]');
    expect(jsonString).not.toContain('{beats}/min');
  });
});
