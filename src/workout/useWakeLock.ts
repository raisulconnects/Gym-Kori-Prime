import { useEffect } from 'react';

/**
 * Keeps the screen on while mounted, so the rest timer stays visible. Browsers only allow this
 * on HTTPS and localhost, so it does nothing when a phone opens the dev server by Wi-Fi address.
 */
export function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let stopped = false;

    async function acquire() {
      try {
        const acquired = await navigator.wakeLock?.request('screen');
        if (!acquired) return;
        if (stopped) void acquired.release();
        else lock = acquired;
      } catch {
        // Refused, for example on low battery. The workout carries on without it.
      }
    }

    // The browser drops the lock when the page is hidden, so take it again on return.
    function onVisibilityChange() {
      if (document.visibilityState === 'visible') void acquire();
    }

    void acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => {
      stopped = true;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      void lock?.release();
    };
  }, []);
}
