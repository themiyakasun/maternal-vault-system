/**
 * Service Worker Registration & Background Sync Helper
 * Conforms to: Section 4.2.3 (Item 2), Section 4.4.2 (FR-01), Section 4.6.5, & TC-08.
 */

export function registerServiceWorker(): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .then((reg) => {
        console.log('✅ Autonomous Background Sync Service Worker registered:', reg.scope);
      })
      .catch((err) => {
        console.warn('⚠️ Service Worker registration failed (falling back to foreground sync):', err);
      });
  });
}

/**
 * Requests an autonomous background sync event from the browser's SyncManager.
 * If the device is currently offline, the browser will wake up the ServiceWorker
 * upon network restoration to dispatch queued mutations.
 */
export async function requestBackgroundSync(tag = 'sync-maternal-records'): Promise<boolean> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    // Check if W3C Background Sync API is supported
    if ('sync' in registration) {
      await (registration as any).sync.register(tag);
      return true;
    }
  } catch (err) {
    console.warn('Background sync registration failed (foreground sync remains active):', err);
  }
  return false;
}
