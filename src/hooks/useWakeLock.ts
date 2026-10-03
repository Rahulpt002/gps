import { useEffect, useState } from 'react';

/**
 * Keeps the screen awake while `enabled` (Screen Wake Lock API).
 * Mobile browsers suspend geolocation when the screen sleeps, so this matters
 * when the phone is mounted in a vehicle. Silently no-ops where unsupported.
 */
export function useWakeLock(enabled: boolean): boolean {
  const [active, setActive] = useState(false);

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      if (document.visibilityState !== 'visible') return;
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) {
          await s.release();
          return;
        }
        sentinel = s;
        setActive(true);
        s.addEventListener('release', () => setActive(false));
      } catch {
        setActive(false);
      }
    };

    // The lock is released automatically when the page is hidden; re-acquire on return.
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && (!sentinel || sentinel.released)) void acquire();
    };

    void acquire();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      sentinel?.release().catch(() => undefined);
      setActive(false);
    };
  }, [enabled]);

  return active;
}
