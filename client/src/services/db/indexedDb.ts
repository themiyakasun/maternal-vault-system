import type { Patient } from '../../types/triage';

export type OfflineMutationType = 'CREATE_PATIENT' | 'UPDATE_PATIENT' | 'DELETE_PATIENT' | 'ADD_VISIT';

export interface QueuedOfflineMutation {
  id: string;
  type: OfflineMutationType;
  clinicId: string;
  patientId: string;
  payload: any;
  createdAt: number;
  retryCount: number;
}

const DB_NAME = 'MaternaVaultClientDB';
const DB_VERSION = 1;

export const STORES = {
  PATIENTS: 'patients',
  MUTATIONS: 'offline_mutations',
  METADATA: 'metadata',
} as const;

let dbInstance: IDBDatabase | null = null;
let dbInitPromise: Promise<IDBDatabase | null> | null = null;

/**
 * Checks if IndexedDB is available in the current execution environment.
 */
export function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

/**
 * Opens and initializes the IndexedDB database with schema versioning,
 * object stores, and indexes.
 */
export function openIndexedDB(): Promise<IDBDatabase | null> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }

  if (dbInitPromise) {
    return dbInitPromise;
  }

  if (!isIndexedDBAvailable()) {
    console.warn('⚠️ IndexedDB is not supported or available in this environment. Falling back gracefully.');
    return Promise.resolve(null);
  }

  dbInitPromise = new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // 1. Patients Object Store
        if (!db.objectStoreNames.contains(STORES.PATIENTS)) {
          const patientStore = db.createObjectStore(STORES.PATIENTS, { keyPath: 'id' });
          patientStore.createIndex('by_clinicId', 'clinicId', { unique: false });
          patientStore.createIndex('by_tenantId', 'tenantId', { unique: false });
          patientStore.createIndex('by_nicNo', 'nicNo', { unique: false });
          patientStore.createIndex('by_riskTier', 'riskTier', { unique: false });
          patientStore.createIndex('by_syncStatus', 'syncStatus', { unique: false });
        }

        // 2. Offline Mutations Object Store
        if (!db.objectStoreNames.contains(STORES.MUTATIONS)) {
          const mutationStore = db.createObjectStore(STORES.MUTATIONS, { keyPath: 'id' });
          mutationStore.createIndex('by_clinicId', 'clinicId', { unique: false });
          mutationStore.createIndex('by_createdAt', 'createdAt', { unique: false });
        }

        // 3. Metadata Store
        if (!db.objectStoreNames.contains(STORES.METADATA)) {
          db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        dbInstance = (event.target as IDBOpenDBRequest).result;
        dbInstance.onversionchange = () => {
          dbInstance?.close();
          dbInstance = null;
        };
        resolve(dbInstance);
      };

      request.onerror = (event) => {
        console.error('Failed to open IndexedDB:', (event.target as IDBOpenDBRequest).error);
        resolve(null);
      };

      request.onblocked = () => {
        console.warn('IndexedDB open request was blocked by an older connection.');
      };
    } catch (err) {
      console.warn('Error opening IndexedDB:', err);
      resolve(null);
    }
  });

  return dbInitPromise;
}

/**
 * Executes a transaction against IndexedDB with automatic error handling
 * and transactional rollback safety.
 */
export async function withTransaction<T>(
  storeNames: string[],
  mode: IDBTransactionMode,
  callback: (transaction: IDBTransaction) => Promise<T> | T
): Promise<T | null> {
  const db = await openIndexedDB();
  if (!db) return null;

  return new Promise((resolve, reject) => {
    try {
      const transaction = db.transaction(storeNames, mode);

      let result: T;
      let callbackError: any = null;

      transaction.oncomplete = () => {
        if (callbackError) {
          reject(callbackError);
        } else {
          resolve(result);
        }
      };

      transaction.onerror = (event) => {
        console.error('IndexedDB transaction failed:', (event.target as IDBTransaction).error);
        reject((event.target as IDBTransaction).error);
      };

      transaction.onabort = (event) => {
        console.warn('IndexedDB transaction aborted:', (event.target as IDBTransaction).error);
        reject(new Error('Transaction aborted'));
      };

      Promise.resolve(callback(transaction))
        .then((res) => {
          result = res;
        })
        .catch((err) => {
          callbackError = err;
          transaction.abort();
        });
    } catch (err) {
      console.error('Failed to initiate IndexedDB transaction:', err);
      reject(err);
    }
  });
}

/**
 * IndexedDB Patient Operations
 */
export const idbPatientStore = {
  async getAllByClinic(clinicId: string): Promise<Patient[]> {
    const db = await openIndexedDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.PATIENTS, 'readonly');
        const store = tx.objectStore(STORES.PATIENTS);
        const index = store.index('by_clinicId');
        const request = index.getAll(clinicId);

        request.onsuccess = () => {
          const results = request.result as Patient[];
          // If none returned by clinicId, try fallback by tenantId
          if (results.length === 0) {
            const tenantIndex = store.index('by_tenantId');
            const tenantReq = tenantIndex.getAll(clinicId);
            tenantReq.onsuccess = () => resolve(tenantReq.result as Patient[]);
            tenantReq.onerror = () => resolve([]);
          } else {
            resolve(results);
          }
        };

        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },

  async getAll(): Promise<Patient[]> {
    const db = await openIndexedDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.PATIENTS, 'readonly');
        const store = tx.objectStore(STORES.PATIENTS);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result as Patient[]);
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  },

  async getById(patientId: string): Promise<Patient | undefined> {
    const db = await openIndexedDB();
    if (!db) return undefined;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.PATIENTS, 'readonly');
        const store = tx.objectStore(STORES.PATIENTS);
        const request = store.get(patientId);
        request.onsuccess = () => resolve(request.result as Patient | undefined);
        request.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  },

  async getByNic(nicNo: string): Promise<Patient | undefined> {
    const db = await openIndexedDB();
    if (!db) return undefined;

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.PATIENTS, 'readonly');
        const store = tx.objectStore(STORES.PATIENTS);
        const index = store.index('by_nicNo');
        const request = index.get(nicNo);
        request.onsuccess = () => resolve(request.result as Patient | undefined);
        request.onerror = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  },

  /**
   * Atomically saves or updates a list of patients within a single ACID transaction.
   */
  /**
   * Atomically synchronizes the list of patients for a clinic within a single ACID transaction.
   * Purges any previously stored patients for this clinic that are no longer in the provided list.
   */
  async savePatients(clinicId: string, patients: Patient[]): Promise<void> {
    const db = await openIndexedDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.PATIENTS, 'readwrite');
        const store = tx.objectStore(STORES.PATIENTS);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(new Error('Transaction aborted during savePatients'));

        const newIdSet = new Set<string>();
        for (const p of patients) {
          if (p.id) {
            newIdSet.add(p.id);
            const trimmed = p.id.trim();
            newIdSet.add(trimmed.startsWith('#') ? trimmed : `#${trimmed}`);
            newIdSet.add(trimmed.startsWith('#') ? trimmed.substring(1) : trimmed);
          }
        }

        // 1. Query existing records for this clinic to delete removed/obsolete ones
        const index = store.index('by_clinicId');
        const req = index.getAll(clinicId);

        req.onsuccess = () => {
          const existing = (req.result as Patient[]) || [];
          for (const item of existing) {
            const trimmed = item.id ? item.id.trim() : '';
            const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
            const withoutHash = trimmed.startsWith('#') ? trimmed.substring(1) : trimmed;

            if (!newIdSet.has(item.id) && !newIdSet.has(withHash) && !newIdSet.has(withoutHash)) {
              store.delete(item.id);
            }
          }

          // 2. Put all active patients
          for (const patient of patients) {
            const p = {
              ...patient,
              clinicId: patient.clinicId || clinicId,
              tenantId: patient.tenantId || clinicId,
            };
            store.put(p);
          }
        };

        req.onerror = () => {
          for (const patient of patients) {
            store.put({
              ...patient,
              clinicId: patient.clinicId || clinicId,
              tenantId: patient.tenantId || clinicId,
            });
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  },

  async deletePatient(patientId: string): Promise<void> {
    const db = await openIndexedDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.PATIENTS, 'readwrite');
        const store = tx.objectStore(STORES.PATIENTS);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        // Delete both hashed and unhashed keys to prevent lingering duplicates
        const trimmed = patientId.trim();
        const withHash = trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
        const withoutHash = trimmed.startsWith('#') ? trimmed.substring(1) : trimmed;

        store.delete(trimmed);
        store.delete(withHash);
        store.delete(withoutHash);
      } catch (err) {
        reject(err);
      }
    });
  },
};

/**
 * IndexedDB Offline Mutations Store
 */
export const idbMutationStore = {
  async getQueue(clinicId?: string): Promise<QueuedOfflineMutation[]> {
    const db = await openIndexedDB();
    if (!db) return [];

    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORES.MUTATIONS, 'readonly');
        const store = tx.objectStore(STORES.MUTATIONS);

        if (clinicId) {
          const index = store.index('by_clinicId');
          const request = index.getAll(clinicId);
          request.onsuccess = () => {
            const list = (request.result as QueuedOfflineMutation[]) || [];
            list.sort((a, b) => a.createdAt - b.createdAt);
            resolve(list);
          };
          request.onerror = () => resolve([]);
        } else {
          const request = store.getAll();
          request.onsuccess = () => {
            const list = (request.result as QueuedOfflineMutation[]) || [];
            list.sort((a, b) => a.createdAt - b.createdAt);
            resolve(list);
          };
          request.onerror = () => resolve([]);
        }
      } catch {
        resolve([]);
      }
    });
  },

  /**
   * Atomically enqueues a mutation. Replaces any identical pending mutation for the same patient.
   */
  async enqueue(mutation: QueuedOfflineMutation): Promise<void> {
    const db = await openIndexedDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.MUTATIONS, 'readwrite');
        const store = tx.objectStore(STORES.MUTATIONS);
        const index = store.index('by_clinicId');
        const request = index.getAll(mutation.clinicId);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        request.onsuccess = () => {
          const existing = (request.result as QueuedOfflineMutation[]) || [];
          const normPatientId = mutation.patientId.replace(/^#/, '');
          // Remove obsolete duplicate mutations, but NEVER deduplicate ADD_VISIT (each visit is unique)
          for (const item of existing) {
            const itemPatientId = item.patientId.replace(/^#/, '');
            if (itemPatientId === normPatientId) {
              if (mutation.type === 'DELETE_PATIENT') {
                store.delete(item.id);
              } else if (mutation.type !== 'ADD_VISIT' && item.type !== 'ADD_VISIT' && item.type === mutation.type) {
                store.delete(item.id);
              }
            }
          }
          store.put(mutation);
        };
      } catch (err) {
        reject(err);
      }
    });
  },

  async remove(id: string): Promise<void> {
    const db = await openIndexedDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.MUTATIONS, 'readwrite');
        const store = tx.objectStore(STORES.MUTATIONS);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        store.delete(id);
      } catch (err) {
        reject(err);
      }
    });
  },

  async removeByPatient(clinicId: string, patientId: string, type?: OfflineMutationType): Promise<void> {
    const db = await openIndexedDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.MUTATIONS, 'readwrite');
        const store = tx.objectStore(STORES.MUTATIONS);
        const index = store.index('by_clinicId');
        const request = index.getAll(clinicId);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        request.onsuccess = () => {
          const items = (request.result as QueuedOfflineMutation[]) || [];
          const targetNorm = patientId.replace(/^#/, '');
          for (const item of items) {
            const itemNorm = item.patientId.replace(/^#/, '');
            if (itemNorm === targetNorm && (!type || item.type === type)) {
              store.delete(item.id);
            }
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  },

  async clearClinic(clinicId: string): Promise<void> {
    const db = await openIndexedDB();
    if (!db) return;

    return new Promise((resolve, reject) => {
      try {
        const tx = db.transaction(STORES.MUTATIONS, 'readwrite');
        const store = tx.objectStore(STORES.MUTATIONS);
        const index = store.index('by_clinicId');
        const request = index.getAll(clinicId);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);

        request.onsuccess = () => {
          const items = (request.result as QueuedOfflineMutation[]) || [];
          for (const item of items) {
            store.delete(item.id);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  },
};

/**
 * Automatic Migration from Legacy localStorage to IndexedDB
 */
export async function migrateFromLocalStorageToIndexedDB(): Promise<{
  migratedPatients: number;
  migratedMutations: number;
}> {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return { migratedPatients: 0, migratedMutations: 0 };
  }

  let migratedPatients = 0;
  let migratedMutations = 0;

  try {
    const CACHE_KEY_PREFIX = 'mv_cached_patients_';
    const QUEUE_KEY_PREFIX = 'mv_offline_mutations_';

    const patientKeys: string[] = [];
    const queueKeys: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        patientKeys.push(key);
      } else if (key?.startsWith(QUEUE_KEY_PREFIX)) {
        queueKeys.push(key);
      }
    }

    if (patientKeys.length === 0 && queueKeys.length === 0) {
      return { migratedPatients: 0, migratedMutations: 0 };
    }

    console.log(`📦 Found legacy localStorage data. Migrating to IndexedDB...`);

    // 1. Migrate patients
    for (const key of patientKeys) {
      const clinicId = key.replace(CACHE_KEY_PREFIX, '');
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const patients = JSON.parse(raw);
          if (Array.isArray(patients) && patients.length > 0) {
            await idbPatientStore.savePatients(clinicId, patients);
            migratedPatients += patients.length;
          }
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed parsing legacy localStorage key ${key}:`, e);
        }
      }
    }

    // 2. Migrate mutation queues
    for (const key of queueKeys) {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          const mutations = JSON.parse(raw);
          if (Array.isArray(mutations) && mutations.length > 0) {
            for (const mut of mutations) {
              await idbMutationStore.enqueue(mut);
              migratedMutations++;
            }
          }
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed parsing legacy queue key ${key}:`, e);
        }
      }
    }

    console.log(
      `✅ IndexedDB Migration Complete: ${migratedPatients} patients and ${migratedMutations} offline mutations migrated from localStorage.`
    );
  } catch (err) {
    console.error('Failed during localStorage to IndexedDB migration:', err);
  }

  return { migratedPatients, migratedMutations };
}
