import { useState, useEffect, useCallback, useRef } from 'react';

export interface NetworkStatus {
  isOnline: boolean;
  wentOfflineAt: Date | null;
  justReconnected: boolean;
  checkConnection: () => Promise<boolean>;
}

/**
 * Hook to track browser online/offline status and alert the user on disconnection.
 */
export function useNetworkStatus(): NetworkStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wentOfflineAt, setWentOfflineAt] = useState<Date | null>(null);
  const [justReconnected, setJustReconnected] = useState<boolean>(false);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    if (!navigator.onLine) {
      setIsOnline(false);
      return false;
    }
    // Perform a lightweight probe if needed
    try {
      const response = await fetch('/sap/public/bc/icf/logoff', {
        method: 'HEAD',
        cache: 'no-store'
      }).catch(() => null);
      // In local dev/mock or offline proxy, status 200-404 implies network interface is alive
      const reachable = response !== null;
      setIsOnline(reachable);
      return reachable;
    } catch {
      return navigator.onLine;
    }
  }, []);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setWentOfflineAt(null);
      setJustReconnected(true);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = setTimeout(() => {
        setJustReconnected(false);
      }, 4500);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWentOfflineAt(new Date());
      setJustReconnected(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, []);

  return {
    isOnline,
    wentOfflineAt,
    justReconnected,
    checkConnection
  };
}
