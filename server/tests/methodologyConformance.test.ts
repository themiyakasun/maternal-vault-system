import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'http';
import app from '../src/app.js';
import { tenantStore } from '../src/db/tenantStore.js';
import { stationCryptoService } from '../src/services/stationCryptoService.js';
import { computePayloadSha256 } from '../src/middleware/idempotencyMiddleware.js';

let server: http.Server;
let baseUrl: string;

before(async () => {
  server = http.createServer(app);
  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const addr = server.address() as any;
      baseUrl = `http://127.0.0.1:${addr.port}`;
      resolve();
    });
  });

  tenantStore.saveTenantToLocal({
    id: 'clinic-4b-rampur',
    code: 'PHP-4B',
    name: 'Primary Health Post 4B',
    division: 'Rampur Division',
    district: 'Rampur District',
    mohArea: 'MOH Rampur Central',
    stationKey: 'MATERNA_VAULT_SECURE_PHM_MUM_71_SECRET_KEY',
    activeMothersCount: 142,
  });

  await tenantStore.createStaffMember({
    id: 'DOC-ANURA-01',
    name: 'Dr. Anura Bandara',
    title: 'MOH Medical Officer',
    role: 'doctor',
    clinicId: 'clinic-4b-rampur',
    password: 'DoctorPass2026!',
  });

  await tenantStore.createStaffMember({
    id: 'PHM-ANOMA-02',
    name: 'Sister Anoma Kumari',
    title: 'Public Health Midwife',
    role: 'phm',
    clinicId: 'clinic-4b-rampur',
    password: 'Anoma@Materna2026!',
  });
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

describe('Methodology Conformance: 5-Point Evaluation Requirements', () => {
  // =========================================================================
  // 1. Role-Based Access Control (RBAC) Differentiation (Sec 4.4.1, Table 4.5)
  // =========================================================================
  describe('1. Role-Based Access Control (PHM vs. MOH Doctor)', () => {
    it('allows MOH Doctor or Admin to access supervisory risk evaluation', async () => {
      // Create a doctor session token
      const doctorToken = tenantStore.generateSessionToken('clinic-4b-rampur', 'DOC-ANURA-01');

      const res = await fetch(`${baseUrl}/api/patients/%231001/evaluate-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${doctorToken}`,
        },
      });

      assert.ok(res.status === 200 || res.status === 404, `Expected 200 or 404 (patient lookup), got ${res.status}`);
      if (res.status === 200) {
        const body = await res.json();
        assert.equal(body.success, true);
      }
    });

    it('blocks PHM from unauthorized supervisory actions with 403 Forbidden', async () => {
      // Find or create a phm user session token
      const phmToken = tenantStore.generateSessionToken('clinic-4b-rampur', 'PHM-ANOMA-02');

      const res = await fetch(`${baseUrl}/api/patients/%231001/evaluate-risk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${phmToken}`,
        },
      });

      // Should be blocked by RBAC
      assert.equal(res.status, 403, 'PHM should be rejected with 403 Forbidden');
      const body = await res.json();
      assert.equal(body.code, 'RBAC_PERMISSION_DENIED');
      assert.ok(body.message.includes('Supervisory role'));
    });
  });

  // =========================================================================
  // 2. SHA-256 Request Idempotency Filter (Sec 3.4.2, Sec 4.6.3, TC-09)
  // =========================================================================
  describe('2. SHA-256 Request Idempotency Filter', () => {
    it('detects replay requests and returns cached response with X-Cache-Lookup: HIT', async () => {
      const idempotencyKey = `test-idem-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const payload = { testField: 'maternal-telemetry-packet', count: 42 };
      const hash = computePayloadSha256(payload);

      // First Request
      const res1 = await fetch(`${baseUrl}/api/sync/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          'X-Payload-Hash': hash,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res1.status, 200);
      assert.equal(res1.headers.get('x-cache-lookup'), 'MISS (First Execution)');
      const body1 = await res1.json();
      assert.equal(body1.success, true);

      // Replayed Request (Identical Key & Hash)
      const res2 = await fetch(`${baseUrl}/api/sync/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
          'X-Payload-Hash': hash,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res2.status, 200);
      assert.equal(res2.headers.get('x-cache-lookup'), 'HIT (Idempotent replay detected)');
      const body2 = await res2.json();
      assert.deepEqual(body1, body2);
    });

    it('rejects duplicate idempotency key used with different payload with 409 Conflict', async () => {
      const idempotencyKey = `conflict-key-${Date.now()}`;
      const payloadA = { patient: 'Anula', status: 'first' };
      const payloadB = { patient: 'Kumari', status: 'tampered' };

      // First call
      await fetch(`${baseUrl}/api/sync/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payloadA),
      });

      // Conflict call with same key but different payload
      const resConflict = await fetch(`${baseUrl}/api/sync/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        body: JSON.stringify(payloadB),
      });

      assert.equal(resConflict.status, 409);
      const conflictBody = await resConflict.json();
      assert.equal(conflictBody.code, 'IDEMPOTENCY_KEY_REUSED');
    });

    it('rejects payload if provided X-Payload-Hash does not match calculated SHA-256', async () => {
      const payload = { safe: true };
      const badHash = 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeefdeadbeef';

      const res = await fetch(`${baseUrl}/api/sync/queue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Payload-Hash': badHash,
        },
        body: JSON.stringify(payload),
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.equal(body.code, 'PAYLOAD_HASH_MISMATCH');
    });
  });

  // =========================================================================
  // 3. Station Cryptographic Signing (Sec 4.5.1 Fig 4.2 & Table 4.7)
  // =========================================================================
  describe('3. Station Cryptographic Signing of Clinical Transactions', () => {
    it('generates and verifies valid station HMAC-SHA256 signatures', () => {
      const clinicId = 'clinic-4b-rampur';
      const timestamp = new Date().toISOString();
      const payloadHash = computePayloadSha256({ test: 'clinical-bundle' });

      const signature = stationCryptoService.signPayload(clinicId, timestamp, payloadHash);
      assert.ok(signature.length === 64, 'Signature should be 64 hex characters');

      const verification = stationCryptoService.verifySignature(clinicId, timestamp, payloadHash, signature);
      assert.equal(verification.valid, true);
    });

    it('rejects forged or tampered station signatures', () => {
      const clinicId = 'clinic-4b-rampur';
      const timestamp = new Date().toISOString();
      const payloadHash = computePayloadSha256({ test: 'clinical-bundle' });

      const forgedSignature = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const verification = stationCryptoService.verifySignature(clinicId, timestamp, payloadHash, forgedSignature);
      assert.equal(verification.valid, false);
      assert.ok(verification.error?.includes('mismatch'));
    });

    it('rejects station signatures with expired timestamp drift (> 15 minutes)', () => {
      const clinicId = 'clinic-4b-rampur';
      const oldTime = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 mins ago
      const payloadHash = computePayloadSha256({ test: 'old-packet' });

      const signature = stationCryptoService.signPayload(clinicId, oldTime, payloadHash);
      const verification = stationCryptoService.verifySignature(clinicId, oldTime, payloadHash, signature);
      assert.equal(verification.valid, false);
      assert.ok(verification.error?.includes('drift too large'));
    });
  });

  // =========================================================================
  // 4. Backend Cloud HL7 FHIR R4 Ingestion & Storage API (Sec 4.4.3 & 4.8.1)
  // =========================================================================
  describe('4. Backend Cloud HL7 FHIR R4 Ingestion & Interoperability API', () => {
    it('GET /fhir/R4/Patient/:id returns compliant FHIR R4 Patient resource', async () => {
      // Fetch #1001 or fallback
      const res = await fetch(`${baseUrl}/fhir/R4/Patient/1001`);
      // If patient exists, verify FHIR format
      if (res.status === 200) {
        assert.equal(res.headers.get('content-type')?.includes('fhir+json'), true);
        const patient = await res.json();
        assert.equal(patient.resourceType, 'Patient');
        assert.ok(patient.id.includes('1001'));
        assert.equal(patient.gender, 'female');
        assert.ok(Array.isArray(patient.identifier));
      } else {
        assert.equal(res.status, 404);
      }
    });

    it('POST /fhir/R4/Bundle ingests external FHIR bundle and persists patient record', async () => {
      const mockFhirBundle = {
        resourceType: 'Bundle',
        type: 'collection',
        entry: [
          {
            fullUrl: 'urn:uuid:12345678-1234-4234-8234-123456789abc',
            resource: {
              resourceType: 'Patient',
              name: [{ family: 'Perera', given: ['Nimali'] }],
              birthDate: '1995-07-20',
              gender: 'female',
              identifier: [{ system: 'https://health.gov.lk/fhir/identifier/nic', value: '199520030400' }],
            },
          },
          {
            fullUrl: 'urn:uuid:22345678-1234-4234-8234-123456789abc',
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: { coding: [{ system: 'http://loinc.org', code: '85354-9' }] },
              component: [
                { code: { coding: [{ code: '8480-6' }] }, valueQuantity: { value: 148, unit: 'mmHg', code: 'mm[Hg]' } },
                { code: { coding: [{ code: '8462-4' }] }, valueQuantity: { value: 96, unit: 'mmHg', code: 'mm[Hg]' } },
              ],
            },
          },
          {
            fullUrl: 'urn:uuid:32345678-1234-4234-8234-123456789abc',
            resource: {
              resourceType: 'Observation',
              status: 'final',
              code: { coding: [{ system: 'http://loinc.org', code: '18185-9' }] },
              valueQuantity: { value: 34, unit: 'wk', code: 'wk' },
            },
          },
        ],
      };

      const res = await fetch(`${baseUrl}/fhir/R4/Bundle`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/fhir+json',
        },
        body: JSON.stringify(mockFhirBundle),
      });

      assert.equal(res.status, 201);
      assert.equal(res.headers.get('content-type')?.includes('fhir+json'), true);
      const resBody = await res.json();
      assert.equal(resBody.resourceType, 'Bundle');
      assert.equal(resBody.type, 'transaction-response');
      assert.ok(resBody.entry[0].response.location.includes('/fhir/R4/Patient/'));
    });
  });
});
