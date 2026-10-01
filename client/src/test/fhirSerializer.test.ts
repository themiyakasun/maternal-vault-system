import { describe, it, expect } from 'vitest';
import { serializePatientToFHIR } from '../utils/fhirSerializer';
import type { Patient } from '../types/triage';

const samplePatient = {
  id: '#1001',
  name: 'Anula Kumari',
  initials: 'AK',
  age: 28,
  dob: '1996-04-12',
  phone: '+94 77 123 4567',
  nicNo: '199451203456',
  gravida: 2,
  para: 1,
  gestationalWeeks: 32,
  gestationalDays: 2,
  trimester: 3,
  bpSystolic: 142,
  bpDiastolic: 92,
  riskTier: 'high',
  riskTitle: 'HIGH RISK',
  riskSubtitle: 'Gestational HTN',
  pretermProbability: 62,
  fhr: '144 bpm',
  hb: 10.1,
  fundalHeight: '31 cm',
  weightKg: 68.5,
  heightCm: 158,
  village: 'Rampur North',
  locality: 'Sector 2',
  mohArea: 'Central District',
  ancVisits: [
    {
      visitNo: 1,
      date: '2024-05-10',
      poa: '12w',
      weightKg: 62.0,
      bp: '120/80',
      examiner: 'Priya Sharma, PHM',
      remarks: 'Normal routine visit',
    } as any,
    {
      visitNo: 2,
      date: '2024-07-15',
      poa: '22w',
      weightKg: 65.0,
      bp: '130/85',
      examiner: 'Priya Sharma, PHM',
      remarks: 'Slight blood pressure elevation',
    } as any,
  ],
};

const RFC_4122_UUID_REGEX = /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('HL7 FHIR Serializer & Validator Conformance', () => {
  it('generates a valid FHIR R4 collection bundle', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);

    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('collection');
    expect(bundle.id).toContain('bundle-maternavault-1001');
    expect(Array.isArray(bundle.entry)).toBe(true);
    expect(bundle.entry.length).toBeGreaterThan(0);
  });

  it('guarantees all fullUrl values strictly adhere to RFC 4122 lowercase UUIDs', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);

    bundle.entry.forEach((entry) => {
      expect(entry.fullUrl).toMatch(RFC_4122_UUID_REGEX);
    });
  });

  it('provides dom-6 XHTML narratives for all resources', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);

    bundle.entry.forEach((entry) => {
      const res = entry.resource as any;
      expect(res.text).toBeDefined();
      expect(res.text.status).toBe('generated');
      expect(res.text.div).toContain('<div xmlns="http://www.w3.org/1999/xhtml">');
    });
  });

  it('includes performer on all Observation resources', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);

    const observations = bundle.entry.filter((e) => e.resource.resourceType === 'Observation');
    expect(observations.length).toBeGreaterThan(0);
    observations.forEach((entry) => {
      const obs = entry.resource as any;
      expect(Array.isArray(obs.performer)).toBe(true);
      expect(obs.performer.length).toBeGreaterThan(0);
      expect(obs.performer[0].display).toBeDefined();
    });
  });

  it('contains compliant Patient resource with correct official identifier', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);
    const patientEntry = bundle.entry.find(e => e.resource.resourceType === 'Patient');

    expect(patientEntry).toBeDefined();
    const patient = patientEntry!.resource as any;
    expect(patient.gender).toBe('female');
    expect(patient.name[0].text).toBe('Anula Kumari');
    expect(patient.name[0].family).toBe('Kumari');
    expect(patient.name[0].given).toContain('Anula');
    expect(patient.identifier[0].value).toBe('199451203456');
    expect(patient.birthDate).toBe('1996-04-12');
  });

  it('contains Blood Pressure panel Observation with LOINC 85354-9 and UCUM mm[Hg]', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);
    const bpEntry = bundle.entry.find(
      e => e.resource.resourceType === 'Observation' && (e.resource as any).code?.coding?.[0]?.code === '85354-9'
    );

    expect(bpEntry).toBeDefined();
    const bp = bpEntry!.resource as any;
    expect(bp.status).toBe('final');
    expect(bp.component.length).toBe(2);

    const systolic = bp.component.find((c: any) => c.code.coding[0].code === '8480-6');
    expect(systolic.valueQuantity.value).toBe(142);
    expect(systolic.valueQuantity.code).toBe('mm[Hg]');
    expect(systolic.valueQuantity.system).toBe('http://unitsofmeasure.org');

    const diastolic = bp.component.find((c: any) => c.code.coding[0].code === '8462-4');
    expect(diastolic.valueQuantity.value).toBe(92);
    expect(diastolic.valueQuantity.code).toBe('mm[Hg]');
  });

  it('contains Gestational Age (LOINC 18185-9) and Fetal Heart Rate (LOINC 55283-6)', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);

    const gaEntry = bundle.entry.find(
      e => e.resource.resourceType === 'Observation' && (e.resource as any).code?.coding?.[0]?.code === '18185-9'
    );
    expect(gaEntry).toBeDefined();
    expect((gaEntry!.resource as any).valueQuantity.value).toBe(32);
    expect((gaEntry!.resource as any).valueQuantity.code).toBe('wk');

    const fhrEntry = bundle.entry.find(
      e => e.resource.resourceType === 'Observation' && (e.resource as any).code?.coding?.[0]?.code === '55283-6'
    );
    expect(fhrEntry).toBeDefined();
    expect((fhrEntry!.resource as any).valueQuantity.value).toBe(144);
    expect((fhrEntry!.resource as any).valueQuantity.code).toBe('/min');
  });

  it('contains Encounter entries with R4 schema by default', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient);
    const encounters = bundle.entry.filter(e => e.resource.resourceType === 'Encounter');

    expect(encounters.length).toBe(2);
    const enc1 = encounters[0].resource as any;
    expect(enc1.status).toBe('finished');
    expect(enc1.class.code).toBe('AMB');
    expect(enc1.serviceType.coding[0].code).toBe('18114009');
    expect(enc1.period).toBeDefined();
  });

  it('adapts Encounter entries to R5 schema when fhirVersion is R5', () => {
    const bundle = serializePatientToFHIR(samplePatient as unknown as Patient, { fhirVersion: 'R5' });
    const encounters = bundle.entry.filter(e => e.resource.resourceType === 'Encounter');

    expect(encounters.length).toBe(2);
    const enc1 = encounters[0].resource as any;
    expect(enc1.status).toBe('finished');
    expect(Array.isArray(enc1.class)).toBe(true);
    expect(enc1.class[0].coding[0].code).toBe('AMB');
    expect(Array.isArray(enc1.serviceType)).toBe(true);
    expect(enc1.serviceType[0].concept.coding[0].code).toBe('18114009');
    expect(enc1.actualPeriod).toBeDefined();
  });
});
