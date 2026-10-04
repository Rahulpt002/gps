import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSimulatedGeolocation } from './simulatedGeolocation';
import { createSession, getAverageSpeed, processPoint } from '@gps/core';
import type { GPSPoint, TrackingSession } from '@gps/core';

afterEach(() => {
  vi.useRealTimers();
});

describe('simulated drive through the session engine', () => {
  it('produces realistic statistics despite injected noise, bad fixes and jumps', () => {
    vi.useFakeTimers();
    const geo = createSimulatedGeolocation(1000);
    let session: TrackingSession = createSession();
    const reasons: string[] = [];

    const id = geo.watchPosition((pos) => {
      const point: GPSPoint = {
        latitude: pos.coords.latitude,
        longitude: pos.coords.longitude,
        accuracy: pos.coords.accuracy,
        speed: pos.coords.speed,
        timestamp: Date.now(),
      };
      const r = processPoint(session, point);
      session = r.session;
      if (r.reason) reasons.push(r.reason);
    });

    vi.advanceTimersByTime(70_000); // one full profile cycle
    geo.clearWatch(id);

    const kmh = (mps: number) => mps * 3.6;
    // Profile peaks around ~29 m/s (~105 km/h); jumps (180 m) must not inflate max.
    expect(kmh(session.maxSpeedMps)).toBeGreaterThan(80);
    expect(kmh(session.maxSpeedMps)).toBeLessThan(140);
    // ~1.3–1.6 km travelled in one cycle.
    expect(session.distanceMeters).toBeGreaterThan(1100);
    expect(session.distanceMeters).toBeLessThan(1900);
    expect(kmh(getAverageSpeed(session))).toBeGreaterThan(55);
    expect(kmh(getAverageSpeed(session))).toBeLessThan(100);
    expect(reasons).toContain('low-accuracy');
  });
});
