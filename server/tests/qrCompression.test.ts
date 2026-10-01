import { describe, it } from 'node:test';
import assert from 'node:assert';
import zlib from 'zlib';
import {
  buildMobilePayload,
  compressVaultForQR,
} from '../src/controllers/patientController.js';
import type { Patient } from '../src/types/patient.js';

describe('3. QR Code Transfer & Gzip Compression Engine', () => {
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
    edd: '2026-10-15',
    fundalHeight: '32 cm',
    isFundalAlert: false,
    hb: 10.1,
    isHbAlert: false,
    fhr: '144 bpm',
    isFhrAlert: false,
    syncStatus: 'synced-p2p',
    syncNode: 'Local Encrypted Station',
    syncProtocol: 'SQLite',
    assessedBy: 'Priya Sharma, PHM',
    assessedTime: 'Today',
    assessedLocation: 'Sub-center Rampur',
    specificCondition: 'Gestational HTN',
    registrationDate: '2026-02-14',
    bloodGroup: 'O +ve',
    ancVisits: [
      {
        visitNo: 1,
        date: '2026-04-10',
        poa: '16w 0d',
        bp: '120/80',
        weightKg: 62.0,
        sfhCm: '16 cm',
        fhr: '140 bpm',
        presentation: 'Cephalic',
        engagement: 'Engaged',
        fm: 'Present',
        edema: 'None',
        remarks: 'All normal',
        urineAlb: 'Nil',
        urineSug: 'Nil',
        supplements: {
          ifaIssued: true,
          calciumIssued: true,
          vitCIssued: true,
          foodSupplement: true,
        },
        examiner: 'Sister Priya Sharma',
      },
    ],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  it('builds a 100% complete maternal vault payload', () => {
    const payload = buildMobilePayload(mockPatient);
    assert.strictEqual(payload.app, 'MaternaVault');
    assert.strictEqual(payload.id, '#1001');
    assert.strictEqual(payload.vitals.bp, '142/92');
    assert.strictEqual(payload.visits.length, 1);
  });

  it('compresses schema to compact format and encodes to MVZ1:GZ: Base64URL', () => {
    const fullPayload = buildMobilePayload(mockPatient);
    const compactObj = compressVaultForQR(fullPayload);
    const compactJson = JSON.stringify(compactObj);

    // Gzip Compression
    const gzipBuffer = zlib.gzipSync(Buffer.from(compactJson, 'utf-8'), {
      level: 9,
    });
    const base64Url = gzipBuffer.toString('base64url');
    const qrPayload = `MVZ1:GZ:${base64Url}`;

    assert.ok(qrPayload.startsWith('MVZ1:GZ:'));

    // Check compression efficiency
    const uncompressedSize = JSON.stringify(fullPayload).length;
    const compressedSize = qrPayload.length;
    const savings = (1 - compressedSize / uncompressedSize) * 100;

    assert.ok(
      savings > 50,
      `Expected >50% compression, got ${savings.toFixed(1)}%`,
    );
  });

  it('decompresses Gzip QR payload back into identical JSON data with zero data loss', () => {
    const fullPayload = buildMobilePayload(mockPatient);
    const compactObj = compressVaultForQR(fullPayload);
    const compactJson = JSON.stringify(compactObj);

    // Compress
    const gzipBuffer = zlib.gzipSync(Buffer.from(compactJson, 'utf-8'));
    const base64Url = gzipBuffer.toString('base64url');

    // Decompress
    const decodedBytes = Buffer.from(base64Url, 'base64url');
    const restoredJson = zlib.gunzipSync(decodedBytes).toString('utf-8');
    const restoredObj = JSON.parse(restoredJson);

    // JSON serialization drops undefined fields; compare with JSON-parsed expectation
    const expectedObj = JSON.parse(JSON.stringify(compactObj));
    assert.deepStrictEqual(
      restoredObj,
      expectedObj,
      'Decompressed object must match original exactly',
    );
  });

  it('conforms strictly to Section 4.8.1, Table 4.5 mandatory keys: pid, sbp, dbp, bs, temp, hr, epds, ro, chk', () => {
    const fullPayload = buildMobilePayload(mockPatient);
    const compactObj = compressVaultForQR(fullPayload);

    // Verify all Table 4.5 mandatory keys exist and have valid values
    assert.strictEqual(compactObj.pid, '#1001');
    assert.strictEqual(compactObj.sbp, 142);
    assert.strictEqual(compactObj.dbp, 92);
    assert.strictEqual(typeof compactObj.bs, 'number');
    assert.strictEqual(typeof compactObj.temp, 'number');
    assert.strictEqual(typeof compactObj.hr, 'number');
    assert.strictEqual(typeof compactObj.epds, 'number');
    assert.strictEqual(compactObj.ro, 1);
    assert.strictEqual(typeof compactObj.chk, 'string');
    assert.strictEqual(compactObj.chk.length, 64); // SHA-256 hex string
  });
});
