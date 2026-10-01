import { localEncryptedDb } from '../db/localEncryptedDb.js';
import { pool, isDatabaseConnected } from '../db/index.js';
import type { Patient } from '../types/patient.js';
import crypto from 'crypto';

/**
 * Deterministic RFC 4122 v4 lowercase UUID generator for FHIR resources
 */
export function createDeterministicUuid(seed: string): string {
  let h1 = 0xdeadbeef, h2 = 0x41c64e6d, h3 = 0x12345678, h4 = 0x87654321;
  for (let i = 0; i < seed.length; i++) {
    const ch = seed.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
    h3 = Math.imul(h3 ^ ch, 3812015801);
    h4 = Math.imul(h4 ^ ch, 2718281829);
  }
  const toHex = (n: number) => (n >>> 0).toString(16).padStart(8, '0');
  const raw = (toHex(h1) + toHex(h2) + toHex(h3) + toHex(h4)).toLowerCase();
  return `${raw.slice(0, 8)}-${raw.slice(8, 12)}-4${raw.slice(13, 16)}-8${raw.slice(17, 20)}-${raw.slice(20, 32)}`;
}

export const fhirService = {
  /**
   * Transforms internal Patient record to standard HL7 FHIR R4 Patient resource
   */
  toFhirPatient(patient: Patient) {
    const safeId = (patient.id || '1001').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    const parts = (patient.name || 'Anonymous Mother').trim().split(/\s+/);
    const family = parts.length > 1 ? parts[parts.length - 1] : parts[0];
    const given = parts.slice(0, parts.length > 1 ? parts.length - 1 : 1);

    return {
      resourceType: 'Patient',
      id: `patient-${safeId}`,
      meta: {
        profile: ['http://hl7.org/fhir/StructureDefinition/Patient'],
      },
      text: {
        status: 'generated',
        div: `<div xmlns="http://www.w3.org/1999/xhtml"><p><b>${patient.name}</b> (NIC: ${patient.nicNo || 'N/A'}, GA: ${patient.gestationalWeeks || 'N/A'}w)</p></div>`,
      },
      identifier: [
        {
          use: 'official',
          system: 'https://health.gov.lk/fhir/identifier/nic',
          value: patient.nicNo || '199000000000',
        },
        {
          use: 'secondary',
          system: 'https://maternavault.org/fhir/identifier/patient-id',
          value: patient.id,
        },
      ],
      active: true,
      name: [
        {
          use: 'official',
          text: patient.name,
          family,
          given,
        },
      ],
      gender: 'female',
      birthDate: patient.dob ? String(patient.dob).slice(0, 10) : '1996-01-01',
      telecom: patient.phone ? [{ system: 'phone', value: patient.phone, use: 'mobile' }] : undefined,
      address: [
        {
          use: 'home',
          line: [patient.locality || patient.village || 'Field Station'],
          city: patient.village || 'Rampur',
          district: patient.mohArea || 'Central District',
          country: 'LKA',
        },
      ],
    };
  },

  /**
   * Generates a complete HL7 FHIR R4 Collection Bundle for a given patient record.
   * Conforms to: Section 4.4.3 (NFR-03) & Section 4.8.1
   */
  toFhirBundle(patient: Patient) {
    const safeId = (patient.id || '1001').replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
    const patientUuid = `urn:uuid:${createDeterministicUuid(`patient-${safeId}`)}`;
    const nowIso = new Date().toISOString();
    const patientResource = this.toFhirPatient(patient);

    const entries: any[] = [
      {
        fullUrl: patientUuid,
        resource: patientResource,
      },
    ];

    const subjectRef = { reference: patientUuid, display: patient.name };
    const vitalCategory = {
      coding: [
        {
          system: 'http://terminology.hl7.org/CodeSystem/observation-category',
          code: 'vital-signs',
          display: 'Vital Signs',
        },
      ],
    };
    const defaultPerformer = [{ display: patient.assessedBy || 'Public Health Midwife (PHM)' }];

    // Observation: Blood Pressure (LOINC 85354-9)
    if (patient.bpSystolic && patient.bpDiastolic) {
      entries.push({
        fullUrl: `urn:uuid:${createDeterministicUuid(`obs-bp-${safeId}`)}`,
        resource: {
          resourceType: 'Observation',
          id: `obs-bp-${safeId}`,
          meta: { profile: ['http://hl7.org/fhir/StructureDefinition/bp'] },
          text: {
            status: 'generated',
            div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>Blood Pressure: ${patient.bpSystolic}/${patient.bpDiastolic} mmHg</p></div>`,
          },
          status: 'final',
          category: [vitalCategory],
          code: {
            coding: [{ system: 'http://loinc.org', code: '85354-9', display: 'Blood pressure panel with all children optional' }],
            text: 'Blood Pressure Panel',
          },
          subject: subjectRef,
          performer: defaultPerformer,
          effectiveDateTime: nowIso,
          component: [
            {
              code: { coding: [{ system: 'http://loinc.org', code: '8480-6', display: 'Systolic blood pressure' }] },
              valueQuantity: { value: Number(patient.bpSystolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
            },
            {
              code: { coding: [{ system: 'http://loinc.org', code: '8462-4', display: 'Diastolic blood pressure' }] },
              valueQuantity: { value: Number(patient.bpDiastolic), unit: 'mmHg', system: 'http://unitsofmeasure.org', code: 'mm[Hg]' },
            },
          ],
        },
      });
    }

    // Observation: Gestational Age (LOINC 18185-9)
    if (patient.gestationalWeeks != null) {
      entries.push({
        fullUrl: `urn:uuid:${createDeterministicUuid(`obs-ga-${safeId}`)}`,
        resource: {
          resourceType: 'Observation',
          id: `obs-ga-${safeId}`,
          text: {
            status: 'generated',
            div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>Gestational Age: ${patient.gestationalWeeks} weeks</p></div>`,
          },
          status: 'final',
          category: [vitalCategory],
          code: {
            coding: [{ system: 'http://loinc.org', code: '18185-9', display: 'Gestational age in weeks' }],
            text: 'Gestational Age',
          },
          subject: subjectRef,
          performer: defaultPerformer,
          effectiveDateTime: nowIso,
          valueQuantity: { value: Number(patient.gestationalWeeks), unit: 'wk', system: 'http://unitsofmeasure.org', code: 'wk' },
        },
      });
    }

    // Encounters (ANC visits)
    const visits = Array.isArray(patient.ancVisits) && patient.ancVisits.length > 0 ? patient.ancVisits : [];
    visits.forEach((v: any, idx: number) => {
      const visitDate = v.date ? String(v.date).slice(0, 10) : nowIso.slice(0, 10);
      entries.push({
        fullUrl: `urn:uuid:${createDeterministicUuid(`enc-${safeId}-${idx + 1}`)}`,
        resource: {
          resourceType: 'Encounter',
          id: `enc-${safeId}-${idx + 1}`,
          text: {
            status: 'generated',
            div: `<div xmlns="http://www.w3.org/1999/xhtml"><p>Antenatal Clinic Visit #${v.visitNo || idx + 1}</p></div>`,
          },
          status: 'finished',
          class: {
            system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
            code: 'AMB',
            display: 'ambulatory',
          },
          serviceType: {
            coding: [{ system: 'http://snomed.info/sct', code: '18114009', display: 'Prenatal visit' }],
            text: `Antenatal Clinic Visit #${v.visitNo || idx + 1}`,
          },
          subject: subjectRef,
          period: { start: `${visitDate}T09:00:00Z`, end: `${visitDate}T09:30:00Z` },
        },
      });
    });

    return {
      resourceType: 'Bundle',
      id: `bundle-maternavault-${safeId}`,
      meta: {
        lastUpdated: nowIso,
        profile: ['http://hl7.org/fhir/StructureDefinition/Bundle'],
      },
      identifier: {
        system: 'https://maternavault.org/fhir/bundle-id',
        value: `MV-FHIR-R4-${safeId}`,
      },
      type: 'collection',
      timestamp: nowIso,
      entry: entries,
    };
  },

  /**
   * Ingests an incoming HL7 FHIR R4 Bundle from external hospital/MOH systems,
   * maps fields to the maternal record schema, and persists it into the database.
   */
  async ingestFhirBundle(bundle: any): Promise<{ success: boolean; patientId?: string; message: string }> {
    if (!bundle || bundle.resourceType !== 'Bundle' || !Array.isArray(bundle.entry)) {
      throw new Error('Invalid payload: expected an HL7 FHIR R4 Bundle resource.');
    }

    const patientEntry = bundle.entry.find((e: any) => e.resource?.resourceType === 'Patient');
    if (!patientEntry) {
      throw new Error('FHIR Bundle missing mandatory Patient resource.');
    }

    const pr = patientEntry.resource;
    const patientName = pr.name?.[0]?.text || 
      (pr.name?.[0]?.given ? `${pr.name[0].given.join(' ')} ${pr.name[0].family || ''}`.trim() : 'FHIR Mother');

    const nicIdentifier = pr.identifier?.find((i: any) => i.system?.includes('nic'))?.value ||
      pr.identifier?.[0]?.value || `NIC-${Date.now()}`;

    // Extract vital observations
    let sbp: number | undefined;
    let dbp: number | undefined;
    let ga: number | undefined;
    let weight: number | undefined;
    let height: number | undefined;

    for (const e of bundle.entry) {
      const res = e.resource;
      if (res?.resourceType === 'Observation') {
        const code = res.code?.coding?.[0]?.code;
        if (code === '85354-9' && Array.isArray(res.component)) {
          for (const comp of res.component) {
            const compCode = comp.code?.coding?.[0]?.code;
            if (compCode === '8480-6') sbp = comp.valueQuantity?.value;
            if (compCode === '8462-4') dbp = comp.valueQuantity?.value;
          }
        }
        if (code === '18185-9') ga = res.valueQuantity?.value;
        if (code === '29463-7') weight = res.valueQuantity?.value;
        if (code === '8302-2') height = res.valueQuantity?.value;
      }
    }

    const newPatientId = `#${Math.floor(1000 + Math.random() * 9000)}`;
    const newRecord: Patient = {
      id: newPatientId,
      name: patientName,
      age: 26,
      dob: pr.birthDate || '1998-01-01',
      nicNo: nicIdentifier,
      phone: pr.telecom?.[0]?.value || '+94 77 000 0000',
      bpSystolic: sbp || 120,
      bpDiastolic: dbp || 80,
      gestationalWeeks: ga || 14,
      weightKg: weight || 62,
      heightCm: height || 158,
      riskTier: (sbp && sbp >= 140) ? 'high' : 'low',
      riskTitle: (sbp && sbp >= 140) ? 'HIGH RISK' : 'LOW RISK',
      riskSubtitle: (sbp && sbp >= 140) ? 'Hypertension Alert' : 'Normal Pregnancy',
      syncStatus: 'synced-p2p',
    };

    // Save to local encrypted store
    localEncryptedDb.insert(newRecord);

    return {
      success: true,
      patientId: newRecord.id,
      message: 'HL7 FHIR R4 Bundle successfully ingested and persisted.',
    };
  },
};
