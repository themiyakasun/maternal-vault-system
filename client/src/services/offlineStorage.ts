import type { Patient } from '../types/triage';
import { patientApi } from './patientApi';
import {
  idbPatientStore,
  idbMutationStore,
  migrateFromLocalStorageToIndexedDB,
  isIndexedDBAvailable,
  type QueuedOfflineMutation,
  type OfflineMutationType,
} from './db/indexedDb';
import { requestBackgroundSync } from '../serviceWorkerRegistration';

export type { QueuedOfflineMutation, OfflineMutationType };

// In-memory hot cache for instant, synchronous UI queries
const memoryPatientCache = new Map<string, Patient[]>();
const memoryMutationQueue = new Map<string, QueuedOfflineMutation[]>();

let isInitialized = false;
let initPromise: Promise<void> | null = null;

export const offlineStorage = {
  /**
   * Initializes IndexedDB and executes one-time migration from legacy localStorage.
   */
  async init(): Promise<void> {
    if (isInitialized) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      try {
        if (isIndexedDBAvailable()) {
          await migrateFromLocalStorageToIndexedDB();
        }
      } catch (err) {
        console.warn('offlineStorage initialization notice:', err);
      } finally {
        isInitialized = true;
      }
    })();

    return initPromise;
  },

  // =========================================================================
  // 1. Local Browser Patients Store (IndexedDB + Synchronous Hot Cache)
  // =========================================================================

  /**
   * Synchronous load from memory cache (populated on boot / previous writes).
   * Ensures zero-latency rendering in React components while IndexedDB runs in the background.
   */
  loadCachedPatients(clinicId: string): Patient[] {
    // 1. Try memory cache first
    const inMem = memoryPatientCache.get(clinicId);
    if (inMem && inMem.length > 0) {
      return inMem;
    }

    // 2. Trigger async background load from IndexedDB
    this.loadCachedPatientsAsync(clinicId).catch(() => {});

    // 3. Fallback to localStorage if migration hasn't run yet
    try {
      if (typeof localStorage !== 'undefined') {
        const raw = localStorage.getItem(`mv_cached_patients_${clinicId}`);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            memoryPatientCache.set(clinicId, parsed);
            return parsed;
          }
        }
      }
    } catch {
      // Ignored
    }

    return [];
  },

  /**
   * Asynchronous load directly from IndexedDB object store with B-Tree indexes.
   */
  async loadCachedPatientsAsync(clinicId: string): Promise<Patient[]> {
    try {
      await this.init();
      if (isIndexedDBAvailable()) {
        const patients = await idbPatientStore.getAllByClinic(clinicId);
        if (patients.length > 0) {
          memoryPatientCache.set(clinicId, patients);
          return patients;
        }
      }
    } catch (e) {
      console.warn('Failed to load cached patients from IndexedDB:', e);
    }
    return memoryPatientCache.get(clinicId) || [];
  },

  /**
   * Persists patients to IndexedDB using atomic ACID transaction (readwrite).
   */
  saveCachedPatients(clinicId: string, patients: Patient[]): void {
    // 1. Instant update to memory cache
    memoryPatientCache.set(clinicId, patients);

    // 2. Transactional async commit to IndexedDB
    if (isIndexedDBAvailable()) {
      idbPatientStore.savePatients(clinicId, patients).catch((err) => {
        console.warn('IndexedDB savePatients transaction error:', err);
      });
    } else {
      // Graceful fallback for non-IndexedDB environments
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`mv_cached_patients_${clinicId}`, JSON.stringify(patients));
        }
      } catch (e) {
        console.warn('Failed to save patients to fallback storage:', e);
      }
    }
  },

  // =========================================================================
  // 2. Transaction-Safe Offline Mutation Queue
  // =========================================================================

  getOfflineQueue(clinicId?: string): QueuedOfflineMutation[] {
    if (clinicId) {
      const q = memoryMutationQueue.get(clinicId);
      if (q) return q;
    } else {
      const all: QueuedOfflineMutation[] = [];
      for (const list of memoryMutationQueue.values()) {
        all.push(...list);
      }
      if (all.length > 0) return all;
    }

    // Trigger async refresh in background
    this.getOfflineQueueAsync(clinicId).catch(() => {});

    // Fallback to localStorage if migration pending
    try {
      if (typeof localStorage !== 'undefined') {
        if (clinicId) {
          const raw = localStorage.getItem(`mv_offline_mutations_${clinicId}`);
          return raw ? JSON.parse(raw) : [];
        }
      }
    } catch {
      // Ignored
    }

    return clinicId ? memoryMutationQueue.get(clinicId) || [] : [];
  },

  async getOfflineQueueAsync(clinicId?: string): Promise<QueuedOfflineMutation[]> {
    try {
      await this.init();
      if (isIndexedDBAvailable()) {
        const queue = await idbMutationStore.getQueue(clinicId);
        if (clinicId) {
          memoryMutationQueue.set(clinicId, queue);
        }
        return queue;
      }
    } catch (e) {
      console.warn('Failed to read offline queue from IndexedDB:', e);
    }
    return this.getOfflineQueue(clinicId);
  },

  enqueueMutation(mutation: Omit<QueuedOfflineMutation, 'id' | 'createdAt' | 'retryCount'>): void {
    const newAction: QueuedOfflineMutation = {
      ...mutation,
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      retryCount: 0,
    };

    // 1. Update in-memory queue
    const currentQueue = memoryMutationQueue.get(mutation.clinicId) || [];
    const filtered = currentQueue.filter(
      (item) => !(item.patientId === mutation.patientId && item.type === mutation.type)
    );
    filtered.push(newAction);
    memoryMutationQueue.set(mutation.clinicId, filtered);

    // 2. Commit transaction to IndexedDB
    if (isIndexedDBAvailable()) {
      idbMutationStore.enqueue(newAction).catch((err) => {
        console.warn('Failed to enqueue mutation into IndexedDB:', err);
      });
    }

    // 3. Request Autonomous Background Sync Worker (Section 4.2.3 & TC-08)
    requestBackgroundSync('sync-maternal-records').catch(() => {});

    console.log(`📥 [IndexedDB] Queued offline mutation [${mutation.type}] for patient ${mutation.patientId}`);
  },

  removeMutation(actionId: string, clinicId: string): void {
    // 1. Update memory
    const currentQueue = memoryMutationQueue.get(clinicId) || [];
    const filtered = currentQueue.filter((item) => item.id !== actionId);
    memoryMutationQueue.set(clinicId, filtered);

    // 2. Remove from IndexedDB
    if (isIndexedDBAvailable()) {
      idbMutationStore.remove(actionId).catch((err) => {
        console.warn('Failed to remove mutation from IndexedDB:', err);
      });
    }
  },

  clearQueue(clinicId: string): void {
    memoryMutationQueue.delete(clinicId);
    if (isIndexedDBAvailable()) {
      idbMutationStore.clearClinic(clinicId).catch((err) => {
        console.warn('Failed to clear IndexedDB queue:', err);
      });
    }
  },

  // =========================================================================
  // 3. Flush & Replay Offline Queue to Backend
  // =========================================================================

  async flushOfflineQueue(
    clinicId: string,
    onSynced?: (updatedPatient?: Patient, mutationType?: OfflineMutationType) => void
  ): Promise<{ synced: number; remaining: number }> {
    const queue = await this.getOfflineQueueAsync(clinicId);
    if (queue.length === 0) {
      return { synced: 0, remaining: 0 };
    }

    // Check if network is connected
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { synced: 0, remaining: queue.length };
    }

    let synced = 0;
    for (const item of queue) {
      try {
        let serverResult: any = null;

        if (item.type === 'CREATE_PATIENT') {
          serverResult = await patientApi.createPatient(item.payload, item.clinicId);
        } else if (item.type === 'UPDATE_PATIENT') {
          serverResult = await patientApi.updatePatient(item.patientId, item.payload, item.clinicId);
        } else if (item.type === 'DELETE_PATIENT') {
          serverResult = await patientApi.deletePatient(item.patientId, item.clinicId);
        } else if (item.type === 'ADD_VISIT') {
          serverResult = await patientApi.addPatientClinicVisit(item.patientId, item.payload, item.clinicId);
        }

        if (serverResult?.success !== false) {
          this.removeMutation(item.id, item.clinicId);
          synced++;
          console.log(`✅ [IndexedDB Sync] Successfully synced offline mutation [${item.type}] for ${item.patientId}`);
          if (onSynced) {
            onSynced(serverResult?.data, item.type);
          }
        } else if (serverResult?.code === 'DUPLICATE_NIC') {
          // If rejected as a duplicate, remove from queue to prevent infinite retry loops
          console.warn(`⚠️ Offline mutation [${item.type}] rejected as DUPLICATE_NIC for ${item.patientId}. Dequeuing.`);
          this.removeMutation(item.id, item.clinicId);
        }
      } catch (err) {
        console.warn(`Network unavailable during flush for [${item.type}] (${item.patientId}):`, err);
        // Break on network error so we don't spam failed requests
        break;
      }
    }

    const remaining = (await this.getOfflineQueueAsync(clinicId)).length;
    return { synced, remaining };
  },

  // =========================================================================
  // 4. Safe Reconciliation: Never wipe out local un-synced data when remote list arrives
  // =========================================================================

  reconcilePatients(
    serverList: Patient[],
    currentLocalList: Patient[],
    clinicId: string
  ): Patient[] {
    const queue = this.getOfflineQueue(clinicId);
    const deletedPatientIds = new Set(
      queue.filter((q) => q.type === 'DELETE_PATIENT').map((q) => q.patientId)
    );

    // Filter out any patients that have a pending offline deletion
    const filteredServer = serverList.filter((p) => !deletedPatientIds.has(p.id));
    const serverIdSet = new Set(filteredServer.map((p) => p.id));

    // Retain any local patient that is not yet on the server, provided it was not explicitly deleted
    const unpushedLocalPatients = currentLocalList.filter((p) => {
      if (deletedPatientIds.has(p.id)) return false;
      return !serverIdSet.has(p.id);
    });

    // Merge: unpushed local patients stay at the top so they never disappear
    const mergedList = [...unpushedLocalPatients, ...filteredServer];

    // Persist to IndexedDB
    this.saveCachedPatients(clinicId, mergedList);

    return mergedList;
  },
};
