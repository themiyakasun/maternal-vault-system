import { describe, it, expect, beforeEach } from 'vitest';
import {
  openIndexedDB,
  idbPatientStore,
  idbMutationStore,
  migrateFromLocalStorageToIndexedDB,
  STORES,
  type QueuedOfflineMutation,
} from '../services/db/indexedDb';
import { offlineStorage } from '../services/offlineStorage';
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
  nicNo: '199612345678',
  abhaId: '91-9988-7766-5544',
  edd: '2026-10-15',
  hb: 10.1,
  isHbAlert: false,
  fhr: '144 bpm',
  isFhrAlert: false,
  syncStatus: 'synced-p2p',
  assessedBy: 'Priya Sharma, PHM',
};

describe('Client IndexedDB Storage & Transactional Safety', () => {
  beforeEach(async () => {
    localStorage.clear();
    const db = await openIndexedDB();
    if (db) {
      await new Promise<void>((resolve) => {
        const tx = db.transaction([STORES.PATIENTS, STORES.MUTATIONS], 'readwrite');
        tx.objectStore(STORES.PATIENTS).clear();
        tx.objectStore(STORES.MUTATIONS).clear();
        tx.oncomplete = () => resolve();
      });
    }
  });

  it('initializes IndexedDB with required object stores and indexes', async () => {
    const db = await openIndexedDB();
    expect(db).toBeDefined();
    expect(db!.name).toBe('MaternaVaultClientDB');

    expect(db!.objectStoreNames.contains(STORES.PATIENTS)).toBe(true);
    expect(db!.objectStoreNames.contains(STORES.MUTATIONS)).toBe(true);
    expect(db!.objectStoreNames.contains(STORES.METADATA)).toBe(true);
  });

  it('atomically saves and retrieves complex patient records with structured cloning', async () => {
    await idbPatientStore.savePatients('clinic-4b-rampur', [mockPatient]);

    const retrieved = await idbPatientStore.getById('#1001');
    expect(retrieved).toBeDefined();
    expect(retrieved!.name).toBe('Anula Kumari');
    expect(retrieved!.bpSystolic).toBe(142);
    expect(retrieved!.riskTier).toBe('high');

    // Verify index lookup by clinicId
    const clinicPatients = await idbPatientStore.getAllByClinic('clinic-4b-rampur');
    expect(clinicPatients.length).toBeGreaterThan(0);
    expect(clinicPatients.some(p => p.id === '#1001')).toBe(true);

    // Verify index lookup by nicNo
    const byNic = await idbPatientStore.getByNic('199612345678');
    expect(byNic).toBeDefined();
    expect(byNic!.id).toBe('#1001');
  });

  it('safely manages offline mutations queue with atomic operations', async () => {
    const testMutation: QueuedOfflineMutation = {
      id: 'mut_test_001',
      type: 'ADD_VISIT',
      clinicId: 'clinic-4b-rampur',
      patientId: '#1001',
      payload: { poa: '32w', bp: '140/90' },
      createdAt: Date.now(),
      retryCount: 0,
    };

    await idbMutationStore.enqueue(testMutation);

    const queue = await idbMutationStore.getQueue('clinic-4b-rampur');
    expect(queue.length).toBeGreaterThan(0);
    expect(queue.some(m => m.id === 'mut_test_001')).toBe(true);

    // Remove mutation atomically
    await idbMutationStore.remove('mut_test_001');
    const updatedQueue = await idbMutationStore.getQueue('clinic-4b-rampur');
    expect(updatedQueue.some(m => m.id === 'mut_test_001')).toBe(false);
  });

  it('migrates legacy localStorage records to IndexedDB and cleans up localStorage', async () => {
    const legacyPatient: Patient = {
      ...mockPatient,
      id: '#9999',
      name: 'Legacy Mother',
      nicNo: '198500000000',
    };

    localStorage.setItem('mv_cached_patients_clinic-legacy', JSON.stringify([legacyPatient]));
    localStorage.setItem(
      'mv_offline_mutations_clinic-legacy',
      JSON.stringify([
        {
          id: 'mut_legacy_1',
          type: 'CREATE_PATIENT',
          clinicId: 'clinic-legacy',
          patientId: '#9999',
          payload: legacyPatient,
          createdAt: Date.now(),
          retryCount: 0,
        },
      ])
    );

    const result = await migrateFromLocalStorageToIndexedDB();
    expect(result.migratedPatients).toBeGreaterThanOrEqual(1);
    expect(result.migratedMutations).toBeGreaterThanOrEqual(1);

    // Verify record now in IndexedDB
    const patientFromIdb = await idbPatientStore.getById('#9999');
    expect(patientFromIdb).toBeDefined();
    expect(patientFromIdb!.name).toBe('Legacy Mother');

    // Verify localStorage key was purged
    expect(localStorage.getItem('mv_cached_patients_clinic-legacy')).toBeNull();
  });

  it('offlineStorage service seamlessly interacts with IndexedDB', async () => {
    offlineStorage.saveCachedPatients('clinic-4b-rampur', [mockPatient]);

    // Memory cache immediate read
    const cached = offlineStorage.loadCachedPatients('clinic-4b-rampur');
    expect(cached.length).toBe(1);
    expect(cached[0].id).toBe('#1001');

    // Async direct IndexedDB read
    const asyncCached = await offlineStorage.loadCachedPatientsAsync('clinic-4b-rampur');
    expect(asyncCached.length).toBe(1);
    expect(asyncCached[0].name).toBe('Anula Kumari');
  });
});
