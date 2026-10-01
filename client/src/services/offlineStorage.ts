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

  /**
   * Immediately deletes a patient from memory cache, fallback storage, and IndexedDB.
   */
  async deleteCachedPatient(clinicId: string, patientId: string): Promise<void> {
    const norm = patientId.trim().replace(/^#/, '');
    // 1. Instant update to memory cache
    const current = memoryPatientCache.get(clinicId) || [];
    const updated = current.filter((p) => {
      const pNorm = (p.id || '').trim().replace(/^#/, '');
      return pNorm !== norm;
    });
    memoryPatientCache.set(clinicId, updated);

    // 2. Update fallback storage
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(`mv_cached_patients_${clinicId}`, JSON.stringify(updated));
      }
    } catch {}

    // 3. Atomically remove from IndexedDB
    if (isIndexedDBAvailable()) {
      await idbPatientStore.deletePatient(patientId);
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

  async enqueueMutation(mutation: Omit<QueuedOfflineMutation, 'id' | 'createdAt' | 'retryCount'>): Promise<void> {
    const newAction: QueuedOfflineMutation = {
      ...mutation,
      id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      createdAt: Date.now(),
      retryCount: 0,
    };

    const normPatientId = mutation.patientId.replace(/^#/, '');

    // 1. Update in-memory queue
    const currentQueue = memoryMutationQueue.get(mutation.clinicId) || [];
    const filtered = currentQueue.filter(
      (item) => !(item.patientId.replace(/^#/, '') === normPatientId && item.type === mutation.type)
    );
    filtered.push(newAction);
    memoryMutationQueue.set(mutation.clinicId, filtered);

    // 2. Commit transaction to IndexedDB
    if (isIndexedDBAvailable()) {
      try {
        await idbMutationStore.enqueue(newAction);
      } catch (err) {
        console.warn('Failed to enqueue mutation into IndexedDB:', err);
      }
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

  async removeMutationByPatient(clinicId: string, patientId: string, type?: OfflineMutationType): Promise<void> {
    const targetNorm = patientId.replace(/^#/, '');
    // 1. Update memory
    const currentQueue = memoryMutationQueue.get(clinicId) || [];
    const filtered = currentQueue.filter(
      (item) => !(item.patientId.replace(/^#/, '') === targetNorm && (!type || item.type === type))
    );
    memoryMutationQueue.set(clinicId, filtered);

    // 2. Remove from IndexedDB
    if (isIndexedDBAvailable()) {
      try {
        await idbMutationStore.removeByPatient(clinicId, patientId, type);
      } catch (err) {
        console.warn('Failed to remove mutation from IndexedDB:', err);
      }
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

    const normalize = (id?: string) => {
      if (!id) return '';
      const trimmed = id.trim();
      return trimmed.startsWith('#') ? trimmed : `#${trimmed}`;
    };

    const deletedPatientIds = new Set<string>();
    for (const q of queue) {
      if (q.type === 'DELETE_PATIENT') {
        deletedPatientIds.add(q.patientId);
        deletedPatientIds.add(normalize(q.patientId));
      }
    }

    // 1. Filter out patients that have a pending offline deletion
    const filteredServer = serverList.filter(
      (p) => !deletedPatientIds.has(p.id) && !deletedPatientIds.has(normalize(p.id))
    );

    const serverIdSet = new Set(filteredServer.map((p) => normalize(p.id)));
    const serverNicSet = new Set(
      filteredServer
        .map((p) => p.nicNo?.trim().toUpperCase())
        .filter((nic): nic is string => Boolean(nic))
    );

    // 2. Retain only genuinely un-synced local patients:
    // - Must not have a pending deletion
    // - Must not already exist on the server by ID or NIC
    // - Must NOT be a record previously marked 'synced-p2p' that the server no longer has (meaning deleted)
    const localForClinic = (currentLocalList || []).filter(
      (p) => !p.clinicId || !p.tenantId || p.clinicId === clinicId || p.tenantId === clinicId
    );

    const unpushedLocalPatients = localForClinic.filter((p) => {
      const normId = normalize(p.id);
      if (deletedPatientIds.has(p.id) || deletedPatientIds.has(normId)) return false;
      if (serverIdSet.has(normId)) return false;
      if (p.nicNo && serverNicSet.has(p.nicNo.trim().toUpperCase())) return false;

      // If this record was already synchronized to the server, and the server no longer returns it,
      // it was deleted from the central database. Do NOT resurrect it!
      if (p.syncStatus === 'synced-p2p') return false;

      return true;
    });

    // 3. Combine: unpushed local entries stay at the top
    const combined = [...unpushedLocalPatients, ...filteredServer];

    // 4. Strict deduplication by normalized ID and NIC
    const seenIds = new Set<string>();
    const seenNics = new Set<string>();
    const deduplicated: Patient[] = [];

    for (const patient of combined) {
      const normId = normalize(patient.id);
      const cleanNic = patient.nicNo ? patient.nicNo.trim().toUpperCase() : null;

      if (seenIds.has(normId)) continue;
      if (cleanNic && seenNics.has(cleanNic)) continue;

      seenIds.add(normId);
      if (cleanNic) seenNics.add(cleanNic);

      deduplicated.push(patient);
    }

    // 5. Persist clean deduplicated list to IndexedDB & memory cache
    this.saveCachedPatients(clinicId, deduplicated);

    return deduplicated;
  },
};
