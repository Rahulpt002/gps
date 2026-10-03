/**
 * Development-only GPS simulator. Enable with `?simulate` in the URL while
 * running `npm run dev`. Produces a repeating drive (accelerate → cruise →
 * brake → stop) with realistic noise, occasional inaccurate fixes and
 * occasional coordinate jumps, so filters can be checked without moving.
 *
 * Device speed is reported as `null` to exercise the coordinate-based fallback.
 */
import type { GeolocationProvider } from '../hooks/useGPSTracking';

const METERS_PER_DEG_LAT = 111_195;
const START = { latitude: 11.2588, longitude: 75.7804 };
const HEADING_RAD = (70 * Math.PI) / 180;

interface Phase {
  seconds: number;
  accel: number; // m/s²
}

const PROFILE: Phase[] = [
  { seconds: 11, accel: 2 }, // 0 → 22 m/s (~79 km/h)
  { seconds: 25, accel: 0 },
  { seconds: 6, accel: 1.2 }, // overtake → ~29 m/s
  { seconds: 10, accel: 0 },
  { seconds: 10, accel: -2.9 }, // brake to stop
  { seconds: 8, accel: 0 }, // idle (tests drift suppression)
];

const gaussian = () => {
  // Box–Muller
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

export function createSimulatedGeolocation(intervalMs = 1000): GeolocationProvider {
  let speed = 0;
  let traveled = 0;
  let tick = 0;
  let nextId = 1;
  const timers = new Map<number, ReturnType<typeof setInterval>>();

  const accelAt = (t: number): number => {
    const total = PROFILE.reduce((s, p) => s + p.seconds, 0);
    let r = t % total;
    for (const p of PROFILE) {
      if (r < p.seconds) return p.accel;
      r -= p.seconds;
    }
    return 0;
  };

  const makePosition = (): GeolocationPosition => {
    const badFix = tick > 0 && tick % 27 === 0;
    const jump = tick > 0 && tick % 41 === 0;
    const accuracy = badFix ? 65 + Math.random() * 20 : 4 + Math.random() * 6;
    const noise = badFix ? 25 : 1.5;
    const along = traveled + (jump ? 180 : 0);
    const north = along * Math.cos(HEADING_RAD) + gaussian() * noise;
    const east = along * Math.sin(HEADING_RAD) + gaussian() * noise;
    const latitude = START.latitude + north / METERS_PER_DEG_LAT;
    const longitude =
      START.longitude + east / (METERS_PER_DEG_LAT * Math.cos((START.latitude * Math.PI) / 180));
      
    // Simulate varying terrain altitude (e.g., going up a small hill)
    const baseAltitude = 250;
    const hill = 80 * Math.sin(traveled / 300);
    const altitude = baseAltitude + hill + gaussian() * 1.5;
    
    // Simulate heading (only accurate when moving)
    const heading = speed > 1 ? (HEADING_RAD * 180 / Math.PI + gaussian() * 5 + 360) % 360 : null;

    return {
      coords: {
        latitude,
        longitude,
        accuracy,
        speed: speed > 0.5 ? speed : null, // mix of null and values to test fallback
        heading,
        altitude,
        altitudeAccuracy: 3,
      },
      timestamp: Date.now(),
    } as unknown as GeolocationPosition;
  };

  const step = () => {
    tick += 1;
    const dt = intervalMs / 1000;
    const next = Math.max(0, speed + accelAt(tick) * dt + gaussian() * 0.15);
    traveled += ((speed + next) / 2) * dt;
    speed = next < 0.2 ? 0 : next;
  };

  return {
    getCurrentPosition(success) {
      globalThis.setTimeout(() => success(makePosition()), 150);
    },
    watchPosition(success) {
      const id = nextId++;
      globalThis.setTimeout(() => success(makePosition()), 300);
      const handle = globalThis.setInterval(() => {
        step();
        success(makePosition());
      }, intervalMs);
      timers.set(id, handle);
      return id;
    },
    clearWatch(id) {
      const handle = timers.get(id);
      if (handle !== undefined) globalThis.clearInterval(handle);
      timers.delete(id);
    },
  };
}
