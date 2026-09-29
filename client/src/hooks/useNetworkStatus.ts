import { useState, useEffect, useCallback } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  isChecking: boolean;
  checkStatus: () => Promise<boolean>;
}

/**
 * Custom hook to detect real-time online/offline connectivity.
 * Combines browser `navigator.onLine` and `online`/`offline` window events
 * with an active lightweight `/health` probe to verify genuine internet/server connectivity.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    return typeof navigator !== 'undefined' ? navigator.onLine : true;
  });
  const [isChecking, setIsChecking] = useState<boolean>(false);

  const checkStatus = useCallback(async (): Promise<boolean> => {
    // 1. If the browser already knows it's offline (e.g. WiFi turned off, airplane mode), return false immediately
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setIsOnline(false);
      return false;
    }

    // 2. Active network probe to verify genuine internet & server reachability
    try {
      setIsChecking(true);
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3500);

      const res = await fetch(`/health?_t=${Date.now()}`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      const online = res.ok;
      setIsOnline(online);
      return online;
    } catch {
      setIsOnline(false);
      return false;
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      // Browser reports network interface reconnected; verify with server probe
      checkStatus();
    };

    const handleOffline = () => {
      // Browser reports network disconnected; immediately switch to offline
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Initial check on mount
    checkStatus();

    // Periodic check every 10 seconds to catch silent disconnections
    const interval = setInterval(() => {
      checkStatus();
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, [checkStatus]);

  return { isOnline, isChecking, checkStatus };
}
