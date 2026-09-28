import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import app from '../src/app.js';
import { localEncryptedDb } from '../src/db/localEncryptedDb.js';
import { tenantStore } from '../src/db/tenantStore.js';

describe('6. Full End-to-End API Integration Testing', () => {
  let server: http.Server;
  let baseUrl: string;
  let authToken: string;
  let sessionCookie: string;
  const testPatientId = '#IT-7701';

  before(async () => {
    // Initialize Local AES-256-GCM Encrypted DB for edge operations
    localEncryptedDb.init();

    // Register a test clinic tenant
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

    // Register a test staff account for API authentication testing
    await tenantStore.createStaffMember({
      id: 'PHM-PRIYA-71',
      name: 'Sister Priya Sharma',
      title: 'Public Health Midwife (Lead)',
      role: 'phm_lead',
      clinicId: 'clinic-4b-rampur',
      password: 'Priya@Materna2026!',
      assignedBeats: ['Rampur Sector 1', 'Rampur Sector 2'],
    });

    // Start server on an ephemeral random OS port (0) to prevent collisions
    await new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as AddressInfo;
        baseUrl = `http://127.0.0.1:${address.port}`;
        resolve();
      });
    });
  });

  after(async () => {
    // Clean up test patient if it exists
    try {
      localEncryptedDb.delete(testPatientId);
    } catch {
      // Ignore cleanup error
    }

    // Shut down the ephemeral HTTP server
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });
  });

  // --------------------------------------------------------------------------
  // SECTION A: HEALTH CHECK & SYSTEM TELEMETRY
  // --------------------------------------------------------------------------
  describe('A. Health & System Telemetry API', () => {
    it('GET /api/health should report healthy status with encryption & ML metadata', async () => {
      const res = await fetch(`${baseUrl}/api/health`);
      assert.strictEqual(res.status, 200);

      const json: any = await res.json();
      assert.strictEqual(json.status, 'healthy');
      assert.strictEqual(json.service, 'MaternaVault Edge Clinical API');
      assert.strictEqual(
        json.storageMode,
        'Local AES-256-GCM Encrypted Primary Store',
      );
      assert.strictEqual(json.encryption.cipher, 'aes-256-gcm');
      assert.ok(json.mlModels.maternalRiskModel, 'ML risk model defined');
      assert.ok(
        typeof json.syncTelemetry === 'object',
        'Sync telemetry present',
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION B: AUTHENTICATION, MULTI-TENANCY & SESSION COOKIES
  // --------------------------------------------------------------------------
  describe('B. Authentication & Multi-Tenant Security Flow', () => {
    it('GET /api/auth/clinics should list available clinics for the station', async () => {
      const res = await fetch(`${baseUrl}/api/auth/clinics`);
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.ok(Array.isArray(json.data));
      assert.ok(json.data.length > 0);
      assert.ok(json.data.some((c: any) => c.id === 'clinic-4b-rampur'));
    });

    it('POST /api/auth/login should reject invalid credentials with 401', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: 'clinic-4b-rampur',
          staffId: 'PHM-PRIYA-71',
          password: 'IncorrectPassword999!',
        }),
      });

      assert.strictEqual(res.status, 401);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, false);
    });

    it('POST /api/auth/login should authenticate staff and set secure httpOnly cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: 'clinic-4b-rampur',
          staffId: 'PHM-PRIYA-71',
          password: 'Priya@Materna2026!',
        }),
      });

      assert.strictEqual(res.status, 200);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.user.id, 'PHM-PRIYA-71');

      // Extract set-cookie header from response
      const rawCookies = res.headers.getSetCookie?.() || [];
      const tokenCookieEntry = rawCookies.find((c) => c.startsWith('token='));
      if (tokenCookieEntry) {
        sessionCookie = tokenCookieEntry.split(';')[0];
        authToken = sessionCookie.replace('token=', '');
      } else {
        const cookieHeader = res.headers.get('set-cookie') || '';
        sessionCookie = cookieHeader.split(';')[0];
        authToken = sessionCookie.replace('token=', '');
      }

      assert.ok(
        sessionCookie.startsWith('token='),
        'Should receive token cookie',
      );
      assert.ok(authToken.length > 20, 'Auth token should be extracted');
    });

    it('GET /api/auth/me should validate current session using cookie or Bearer token', async () => {
      const res = await fetch(`${baseUrl}/api/auth/me`, {
        headers: {
          Cookie: sessionCookie,
          Authorization: `Bearer ${authToken}`,
        },
      });

      assert.strictEqual(res.status, 200);
      const json = (await res.json()) as {
        success: boolean;
        user: { id: string; clinicId: string };
      };
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.user.id, 'PHM-PRIYA-71');
      assert.strictEqual(json.user.clinicId, 'clinic-4b-rampur');
    });

    it('POST /api/auth/logout should clear session cookie', async () => {
      const res = await fetch(`${baseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { Cookie: sessionCookie },
      });

      assert.strictEqual(res.status, 200);
      const setCookies = res.headers.getSetCookie?.() || [
        res.headers.get('set-cookie') || '',
      ];
      assert.ok(
        setCookies.some(
          (c) =>
            c.includes('token=;') ||
            c.includes('Max-Age=0') ||
            c.includes('expires='),
        ),
        'Cookie cleared',
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION C: PATIENT REGISTRATION & CLINICAL LIFECYCLE
  // --------------------------------------------------------------------------
  describe('C. Patient Lifecycle & Clinical Data Integration', () => {
    it('POST /api/patients should register a new pregnant mother with ML risk tier', async () => {
      const newPatientPayload = {
        id: testPatientId,
        name: 'Sunethra Jayawardena',
        age: 29,
        gravida: 2,
        para: 1,
        gestationalWeeks: 26,
        gestationalDays: 2,
        bpSystolic: 120,
        bpDiastolic: 78,
        bmi: 23.5,
        hb: 11.6,
        bloodGroup: 'B +ve',
        fhr: '140 bpm',
        fundalHeight: '26 cm',
        village: 'Rampur South',
        locality: 'Sector 5',
        tenantId: 'clinic-4b-rampur',
        clinicId: 'clinic-4b-rampur',
        notes: 'Routine booking visit recorded during integration test run.',
      };

      const res = await fetch(`${baseUrl}/api/patients`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-tenant-id': 'clinic-4b-rampur',
        },
        body: JSON.stringify(newPatientPayload),
      });

      assert.strictEqual(res.status, 201);
      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, testPatientId);
      assert.strictEqual(json.data.name, 'Sunethra Jayawardena');
      assert.strictEqual(json.data.riskTier, 'low');
    });

    it('GET /api/patients/:id should fetch the created patient from AES-256-GCM store', async () => {
      const res = await fetch(
        `${baseUrl}/api/patients/${encodeURIComponent(testPatientId)}`,
      );
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.id, testPatientId);
      assert.strictEqual(json.data.bloodGroup, 'B +ve');
      assert.strictEqual(json.data.trimester, 2);
    });

    it('GET /api/patients should list and filter patients by query parameters', async () => {
      const res = await fetch(
        `${baseUrl}/api/patients?search=Sunethra&tenantId=clinic-4b-rampur`,
      );
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as any;
      assert.strictEqual(json.success, true);
      assert.ok(
        json.data.length >= 1,
        'Should find Sunethra in filtered results',
      );
      assert.strictEqual(json.data[0].id, testPatientId);
    });

    it('POST /api/patients/:id/visits should record an ANC visit with vitals', async () => {
      const ancVisitPayload = {
        visitNo: 2,
        date: '2026-09-28',
        gestationalWeeks: 28,
        weightKg: 64.5,
        bpSystolic: 148, // Stage 2 Hypertension
        bpDiastolic: 96,
        fundalHeight: '28 cm',
        fhr: '146 bpm',
        urineAlb: '1+',
        hb: 10.2,
        notes:
          'BP elevated at sub-center visit. Urinalysis reveals trace albumin.',
        examiner: 'Sister Priya Sharma, PHM',
        location: 'Sub-center Rampur South',
      };

      const res = await fetch(
        `${baseUrl}/api/patients/${encodeURIComponent(testPatientId)}/visits`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ancVisitPayload),
        },
      );

      assert.strictEqual(res.status, 201);
      const json = (await res.json()) as {
        success: boolean;
        data: {
          patient: {
            bpSystolic: number;
            bpDiastolic: number;
            isBpAlert: boolean;
            riskTier: string;
            ancVisits: unknown[];
          };
        };
      };
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.patient.bpSystolic, 148);
      assert.strictEqual(json.data.patient.bpDiastolic, 96);
      assert.strictEqual(
        json.data.patient.isBpAlert,
        true,
        'BP alert should trigger',
      );
      assert.strictEqual(
        json.data.patient.riskTier,
        'high',
        'Patient risk tier must escalate to high',
      );
      assert.ok(
        json.data.patient.ancVisits.length >= 1,
        'ANC visit history should include new visit',
      );
    });

    it('POST /api/patients/:id/evaluate-risk should recalculate 3-model risk on demand', async () => {
      const res = await fetch(
        `${baseUrl}/api/patients/${encodeURIComponent(testPatientId)}/evaluate-risk`,
        {
          method: 'POST',
        },
      );

      assert.strictEqual(res.status, 200);
      const json = (await res.json()) as {
        success: boolean;
        data: { riskTier: string; pretermProbability: number };
      };
      assert.strictEqual(json.success, true);
      assert.strictEqual(json.data.riskTier, 'high');
      assert.ok(
        json.data.pretermProbability > 40,
        'Preterm probability elevated due to hypertension',
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION D: QR CODE GENERATION & MOBILE EMERGENCY PASS
  // --------------------------------------------------------------------------
  describe('D. Emergency QR Code & Mobile Pass Flow', () => {
    it('GET /api/patients/:id/qr?mode=gzip should generate Gzip compressed payload & QR data URI', async () => {
      const res = await fetch(
        `${baseUrl}/api/patients/${encodeURIComponent(testPatientId)}/qr?mode=gzip`,
      );
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as {
        success: boolean;
        data: {
          qrDataUrl: string;
          encodedPayload: string;
          compressionStats: { compressedSize: number; originalSize: number };
        };
      };
      assert.strictEqual(json.success, true);
      assert.ok(
        json.data.qrDataUrl.startsWith('data:image/'),
        'Should return QR image data URI',
      );
      assert.ok(
        json.data.encodedPayload.startsWith('MVZ1:GZ:'),
        'Payload format must be MVZ1:GZ:',
      );
      assert.ok(
        json.data.compressionStats.compressedSize <
          json.data.compressionStats.originalSize,
        'Compression must reduce size',
      );
    });

    it('GET /mobile/patient/:id should render mobile-friendly HTML emergency card', async () => {
      const res = await fetch(
        `${baseUrl}/mobile/patient/${encodeURIComponent(testPatientId)}`,
      );
      assert.strictEqual(res.status, 200);
      const contentType = res.headers.get('content-type') || '';
      assert.ok(contentType.includes('text/html'), 'Must return HTML view');

      const html = await res.text();
      assert.ok(
        html.includes('Sunethra Jayawardena'),
        'Patient name should appear in emergency card',
      );
      assert.ok(
        html.includes('Pregnancy Record'),
        'App title rendered in card',
      );
    });
  });

  // --------------------------------------------------------------------------
  // SECTION E: SYNC CONTROLLER & DATA CLEANUP
  // --------------------------------------------------------------------------
  describe('E. Synchronization & Database Teardown', () => {
    it('GET /api/sync/status should provide offline sync telemetry', async () => {
      const res = await fetch(`${baseUrl}/api/sync/status`);
      assert.strictEqual(res.status, 200);

      const json = (await res.json()) as {
        success: boolean;
        data: {
          telemetry: { pendingRecordsCount: number };
          encryptionMeta: unknown;
        };
      };
      assert.strictEqual(json.success, true);
      assert.ok(json.data.telemetry, 'Telemetry object present');
      assert.ok(json.data.encryptionMeta, 'Encryption metadata present');
      assert.ok(
        typeof json.data.telemetry.pendingRecordsCount === 'number',
        'Pending records count tracked',
      );
    });

    it('DELETE /api/patients/:id should delete patient cleanly', async () => {
      const res = await fetch(
        `${baseUrl}/api/patients/${encodeURIComponent(testPatientId)}`,
        {
          method: 'DELETE',
        },
      );

      assert.strictEqual(res.status, 200);
      const json = (await res.json()) as { success: boolean };
      assert.strictEqual(json.success, true);

      // Verify deletion in GET
      const verifyRes = await fetch(
        `${baseUrl}/api/patients/${encodeURIComponent(testPatientId)}`,
      );
      assert.strictEqual(verifyRes.status, 404);
    });
  });
});
