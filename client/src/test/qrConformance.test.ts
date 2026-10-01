import { describe, it, expect } from 'vitest';
import { compressVaultForQR } from '../components/Modals/PatientQRModal';
import { sha256 } from '../utils/cryptoUtils';

const mockPatientVault = {
  id: '#1001',
  name: 'Anula Kumari',
  age: 28,
  gravida: 2,
  para: 1,
  livingChildren: 1,
  gestationalWeeks: 32,
  bpSystolic: 142,
  bpDiastolic: 92,
  bloodSugar: 96,
  temperature: 36.7,
  heartRate: 82,
  epdsScore: 5,
  riskTier: 'high',
  pretermProbability: 62,
  hb: 10.1,
  fhr: '144 bpm',
  pregnancies: [],
  visits: [],
};

describe('Compact Optical QR Key Conformance (Section 4.8.1, Table 4.5)', () => {
  it('strictly serializes QR payload with all Table 4.5 mandated keys: pid, sbp, dbp, bs, temp, hr, epds, ro, chk', () => {
    const compact = compressVaultForQR(mockPatientVault);

    // 1. Mandatory Table 4.5 keys exist
    expect(compact).toHaveProperty('pid');
    expect(compact).toHaveProperty('sbp');
    expect(compact).toHaveProperty('dbp');
    expect(compact).toHaveProperty('bs');
    expect(compact).toHaveProperty('temp');
    expect(compact).toHaveProperty('hr');
    expect(compact).toHaveProperty('epds');
    expect(compact).toHaveProperty('ro');
    expect(compact).toHaveProperty('chk');

    // 2. Value validation
    expect(compact.pid).toBe('#1001');
    expect(compact.sbp).toBe(142);
    expect(compact.dbp).toBe(92);
    expect(compact.bs).toBe(96);
    expect(compact.temp).toBe(36.7);
    expect(compact.hr).toBe(82);
    expect(compact.epds).toBe(5);
    expect(compact.ro).toBe(1);

    // 3. Cryptographic SHA-256 Checksum validation
    expect(typeof compact.chk).toBe('string');
    expect(compact.chk.length).toBe(64); // 256 bits = 64 hex characters
    expect(/^[0-9a-f]{64}$/.test(compact.chk)).toBe(true);

    const expectedChk = sha256('#1001|142|92|96|36.7|82|5|1');
    expect(compact.chk).toBe(expectedChk);
  });

  it('handles fallback extraction when vitals are formatted as strings or nested in objects', () => {
    const stringVitalsVault = {
      id: '#1002',
      vitals: {
        bp: '130/85',
        fhr: '140 bpm',
      },
      labResults: {
        fbs: 104,
      },
    };

    const compact = compressVaultForQR(stringVitalsVault);

    expect(compact.pid).toBe('#1002');
    expect(compact.sbp).toBe(130);
    expect(compact.dbp).toBe(85);
    expect(compact.bs).toBe(104);
    expect(compact.temp).toBe(36.8); // default
    expect(compact.hr).toBe(140);   // parsed from fhr string
    expect(compact.ro).toBe(1);
    expect(compact.chk.length).toBe(64);
  });
});
