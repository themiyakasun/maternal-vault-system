import { describe, it } from 'node:test';
import assert from 'node:assert';
import { tenantStore } from '../src/db/tenantStore.js';
import { hashPassword, generateSalt } from '../src/db/index.js';

describe('1. Authentication & Security Engine', () => {
  it('should list all configured clinic stations', async () => {
    const clinics = await tenantStore.getClinics();
    assert.ok(Array.isArray(clinics), 'Clinics should be an array');
    assert.ok(clinics.length > 0, 'Should return at least 1 default clinic');

    const rampurClinic = clinics.find((c) => c.id === 'clinic-4b-rampur');
    assert.ok(rampurClinic, 'Default Rampur clinic should exist');
    assert.strictEqual(rampurClinic?.mohArea, 'MOH Rampur Central');
  });

  it('should authenticate staff with valid password and return session token', async () => {
    const authResult = await tenantStore.authenticateStaff(
      'clinic-4b-rampur',
      'PHM-PRIYA-71',
      'Priya@Materna2026!',
    );

    assert.strictEqual(
      authResult.success,
      true,
      'Authentication should succeed',
    );
    assert.ok(authResult.token, 'Should return a JWT token');
    assert.strictEqual(authResult.user?.name, 'Sister Priya Sharma');
    assert.strictEqual(authResult.user?.role, 'phm_lead');
  });

  it('should reject authentication when an incorrect password is provided', async () => {
    const authResult = await tenantStore.authenticateStaff(
      'clinic-4b-rampur',
      'PHM-PRIYA-71',
      'WrongPassword123!',
    );

    assert.strictEqual(authResult.success, false, 'Authentication must fail');
    assert.strictEqual(authResult.token, undefined);
  });

  it('should verify a valid session token and extract user & clinic identity', async () => {
    const authResult = await tenantStore.authenticateStaff(
      'clinic-4b-rampur',
      'PHM-PRIYA-71',
      'Priya@Materna2026!',
    );

    const verification = tenantStore.verifyToken(authResult.token!);
    assert.strictEqual(verification.valid, true);
    assert.strictEqual(verification.session?.userId, 'PHM-PRIYA-71');
    assert.strictEqual(verification.session?.clinicId, 'clinic-4b-rampur');
  });

  it('should reject forged or corrupted session tokens', () => {
    const forgedToken =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.tampered.signature';
    const verification = tenantStore.verifyToken(forgedToken);
    assert.strictEqual(verification.valid, false);
  });
});
