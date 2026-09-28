import type { Patient } from '../types/triage';
import { patientApi } from './patientApi';

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

const CACHE_KEY_PREFIX = 'mv_cached_patients_';
const QUEUE_KEY_PREFIX = 'mv_offline_mutations_';

export const offlineStorage = {
  // 1. Local Browser Patients Cache
  loadCachedPatients(clinicId: string): Patient[] {
    try {
      const raw = localStorage.getItem(`${CACHE_KEY_PREFIX}${clinicId}`);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Failed to load cached patients from localStorage:', e);
      return [];
    }
  },

  saveCachedPatients(clinicId: string, patients: Patient[]): void {
    try {
      localStorage.setItem(`${CACHE_KEY_PREFIX}${clinicId}`, JSON.stringify(patients));
    } catch (e) {
      console.warn('Failed to save patients to localStorage cache:', e);
    }
  },

  // 2. Offline Mutation Queue
  getOfflineQueue(clinicId?: string): QueuedOfflineMutation[] {
    try {
      const key = clinicId ? `${QUEUE_KEY_PREFIX}${clinicId}` : null;
      if (key) {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : [];
      }

      // Collect across all clinics if no clinicId provided
      const all: QueuedOfflineMutation[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith(QUEUE_KEY_PREFIX)) {
          const raw = localStorage.getItem(k);
          if (raw) {
            all.push(...JSON.parse(raw));
          }
        }
      }
      return all;
    } catch (e) {
      console.warn('Failed to read offline mutation queue:', e);
      return [];
    }
  },

  enqueueMutation(mutation: Omit<QueuedOfflineMutation, 'id' | 'createdAt' | 'retryCount'>): void {
    try {
      const queueKey = `${QUEUE_KEY_PREFIX}${mutation.clinicId}`;
      const queue = this.getOfflineQueue(mutation.clinicId);
      
      const newAction: QueuedOfflineMutation = {
        ...mutation,
        id: `mut_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: Date.now(),
        retryCount: 0,
      };

      // If there's an existing pending mutation of the same type for the same patient, replace or append
      const filtered = queue.filter(
        item => !(item.patientId === mutation.patientId && item.type === mutation.type)
      );

      filtered.push(newAction);
      localStorage.setItem(queueKey, JSON.stringify(filtered));
      console.log(`📥 Queued offline mutation [${mutation.type}] for patient ${mutation.patientId}`);
    } catch (e) {
      console.warn('Failed to enqueue offline mutation:', e);
    }
  },

  removeMutation(actionId: string, clinicId: string): void {
    try {
      const queueKey = `${QUEUE_KEY_PREFIX}${clinicId}`;
      const queue = this.getOfflineQueue(clinicId);
      const filtered = queue.filter(item => item.id !== actionId);
      localStorage.setItem(queueKey, JSON.stringify(filtered));
    } catch (e) {
      console.warn('Failed to remove mutation from queue:', e);
    }
  },

  clearQueue(clinicId: string): void {
    try {
      localStorage.removeItem(`${QUEUE_KEY_PREFIX}${clinicId}`);
    } catch (e) {
      console.warn('Failed to clear queue:', e);
    }
  },

  // 3. Flush & Replay Offline Queue to Backend
  async flushOfflineQueue(
    clinicId: string,
    onSynced?: (updatedPatient?: Patient, mutationType?: OfflineMutationType) => void
  ): Promise<{ synced: number; remaining: number }> {
    const queue = this.getOfflineQueue(clinicId);
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
          console.log(`✅ Successfully synced offline mutation [${item.type}] for ${item.patientId}`);
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

    const remaining = this.getOfflineQueue(clinicId).length;
    return { synced, remaining };
  },

  // 4. Safe Reconciliation: Never wipe out local un-synced data when remote list arrives
  reconcilePatients(
    serverList: Patient[],
    currentLocalList: Patient[],
    clinicId: string
  ): Patient[] {
    const queue = this.getOfflineQueue(clinicId);
    const deletedPatientIds = new Set(
      queue.filter(q => q.type === 'DELETE_PATIENT').map(q => q.patientId)
    );

    // Filter out any patients that have a pending offline deletion
    const filteredServer = serverList.filter(p => !deletedPatientIds.has(p.id));
    const serverIdSet = new Set(filteredServer.map(p => p.id));

    // Retain any local patient that is not yet on the server, provided it was not explicitly deleted
    const unpushedLocalPatients = currentLocalList.filter(p => {
      if (deletedPatientIds.has(p.id)) return false;
      return !serverIdSet.has(p.id);
    });

    // Merge: unpushed local patients stay at the top so they never disappear
    const mergedList = [...unpushedLocalPatients, ...filteredServer];

    // Persist to local browser storage so page reloads also retain them
    this.saveCachedPatients(clinicId, mergedList);

    return mergedList;
  }
};
