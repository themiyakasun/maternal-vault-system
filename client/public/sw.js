/**
 * MaternaVault Autonomous Background Sync Worker
 * Conforms to: Section 4.2.3 (Item 2), Section 4.4.2 (FR-01), Section 4.6.5 (Fig METHODOLOGY.7), & TC-08.
 *
 * Runs autonomously in the background even if the foreground browser tab is minimized or closed.
 * Listens for the W3C Background Sync API 'sync' event to drain pending IndexedDB mutations upon network restoration.
 */

const CACHE_NAME = 'maternavault-sw-v1';
const SYNC_TAG = 'sync-maternal-records';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

/**
 * Autonomous Background Sync Event Listener
 */
self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG || event.tag === 'sync-offline-mutations') {
    event.waitUntil(drainOfflineQueueInBackground());
  }
});

/**
 * Background worker task: directly reads IndexedDB and pushes pending mutations to the server.
 */
async function drainOfflineQueueInBackground() {
  try {
    const db = await openIndexedDb();
    if (!db) return;

    const pendingMutations = await getPendingMutationsFromDb(db);
    if (!pendingMutations || pendingMutations.length === 0) return;

    const syncPayload = {
      uuid: `sw-sync-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
      syncId: `SW-SYNC-${Date.now()}`,
      mutations: pendingMutations,
      timestamp: new Date().toISOString(),
      source: 'ServiceWorker-BackgroundSync',
    };

    const response = await fetch('/api/sync/queue', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Idempotency-Key': syncPayload.uuid,
        'X-Source': 'BackgroundSyncWorker',
      },
      body: JSON.stringify(syncPayload),
    });

    if (response.ok) {
      // Mark mutations as synced in IndexedDB
      await markMutationsSyncedInDb(db, pendingMutations.map((m) => m.id));
      
      // Notify active client tabs if open
      const clients = await self.clients.matchAll();
      clients.forEach((client) => {
        client.postMessage({
          type: 'BACKGROUND_SYNC_COMPLETE',
          count: pendingMutations.length,
          timestamp: new Date().toISOString(),
        });
      });
    }
  } catch (err) {
    console.warn('[ServiceWorker] Background sync dispatch failed (will retry on next reconnection):', err);
    throw err; // Rethrowing allows the browser to retry the sync event later
  }
}

function openIndexedDb() {
  return new Promise((resolve) => {
    const request = indexedDB.open('MaternaVaultDB', 1);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function getPendingMutationsFromDb(db) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains('offline_mutations')) {
      return resolve([]);
    }
    const tx = db.transaction('offline_mutations', 'readonly');
    const store = tx.objectStore('offline_mutations');
    const req = store.getAll();
    req.onsuccess = () => {
      const items = (req.result || []).filter((m) => m.synced === false || m.synced === undefined);
      resolve(items);
    };
    req.onerror = () => resolve([]);
  });
}

function markMutationsSyncedInDb(db, ids) {
  return new Promise((resolve) => {
    if (!db.objectStoreNames.contains('offline_mutations')) return resolve();
    const tx = db.transaction('offline_mutations', 'readwrite');
    const store = tx.objectStore('offline_mutations');
    ids.forEach((id) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        if (getReq.result) {
          getReq.result.synced = true;
          getReq.result.syncedAt = new Date().toISOString();
          store.put(getReq.result);
        }
      };
    });
    tx.oncomplete = () => resolve();
    tx.onerror = () => resolve();
  });
}
