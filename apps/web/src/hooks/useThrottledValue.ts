import { useEffect, useRef, useState } from 'react';

/**
 * Returns `value`, updated at most once per `intervalMs` (leading + trailing).
 * Used to decouple map/chart rendering frequency from GPS sampling frequency:
 * the engine still processes every fix; only the visuals are rate-limited.
 * When `immediate` is true, updates pass straight through (e.g. when stopped).
 */
export function useThrottledValue<T>(value: T, intervalMs: number, immediate = false): T {
  const [throttled, setThrottled] = useState(value);
  const lastUpdateRef = useRef(0);

  useEffect(() => {
    const elapsed = Date.now() - lastUpdateRef.current;
    if (immediate || elapsed >= intervalMs) {
      lastUpdateRef.current = Date.now();
      setThrottled(value);
      return;
    }
    const id = window.setTimeout(() => {
      lastUpdateRef.current = Date.now();
      setThrottled(value);
    }, intervalMs - elapsed);
    return () => window.clearTimeout(id);
  }, [value, intervalMs, immediate]);

  return throttled;
}
