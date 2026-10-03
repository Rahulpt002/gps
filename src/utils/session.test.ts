import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACKING_CONFIG } from '../constants/tracking';
import type { GPSPoint } from '../types/gps';
import {
  beginSegment,
  createSession,
  createTimer,
  getAverageSpeed,
  getElapsed,
  processPoint,
  processPoints,
  startTimer,
  stopTimer,
} from './session';

const METERS_PER_DEG = 111195.08; // along the equator
const T0 = 1_700_000_000_000;

/** Straight eastward track along the equator. */
function track(
  speedsMps: number[],
  opts: { accuracy?: number; deviceSpeed?: boolean; startMeters?: number; t0?: number } = {},
): GPSPoint[] {
  const { accuracy = 5, deviceSpeed = false, startMeters = 0, t0 = T0 } = opts;
  let x = startMeters;
  const points: GPSPoint[] = [{ latitude: 0, longitude: x / METERS_PER_DEG, timestamp: t0, accuracy, speed: deviceSpeed ? speedsMps[0] ?? 0 : null }];
  speedsMps.forEach((v, i) => {
    x += v;
    points.push({
      latitude: 0,
      longitude: x / METERS_PER_DEG,
      timestamp: t0 + (i + 1) * 1000,
      accuracy,
      speed: deviceSpeed ? v : null,
    });
  });
  return points;
}

describe('session statistics (fallback speed from coordinates)', () => {
  const points = track(Array(59).fill(10)); // 10 m/s for 59 s
  const s = processPoints(points);

  it('accumulates distance', () => {
    expect(s.distanceMeters).toBeCloseTo(590, 0);
  });

  it('tracks moving time', () => {
    expect(s.movingTimeMs).toBeCloseTo(59_000, -2);
  });

  it('computes average speed as distance / moving time', () => {
    expect(getAverageSpeed(s)).toBeCloseTo(10, 1);
  });

  it('records maximum speed', () => {
    expect(s.maxSpeedMps).toBeCloseTo(10, 1);
  });

  it('converges the smoothed current speed', () => {
    expect(s.currentSpeedMps).toBeCloseTo(10, 1);
  });
});

describe('session statistics (device-reported speed)', () => {
  it('handles walking pace below the movement threshold per sample', () => {
    const s = processPoints(track(Array(10).fill(2), { deviceSpeed: true }));
    expect(s.distanceMeters).toBeCloseTo(20, 0);
    expect(s.movingTimeMs).toBeCloseTo(10_000, -2);
    expect(getAverageSpeed(s)).toBeCloseTo(2, 1);
    expect(s.maxSpeedMps).toBeCloseTo(2, 5);
  });

  it('excludes stopped time from average speed', () => {
    // 20 s driving at 10 m/s, 30 s stopped, 20 s driving.
    const drive1 = track(Array(20).fill(10), { deviceSpeed: true });
    const stop = track(Array(30).fill(0), { deviceSpeed: true, startMeters: 200, t0: T0 + 20_000 }).slice(1);
    const drive2 = track(Array(20).fill(10), { deviceSpeed: true, startMeters: 200, t0: T0 + 50_000 }).slice(1);
    const s = processPoints([...drive1, ...stop, ...drive2]);
    expect(s.distanceMeters).toBeCloseTo(400, -1);
    expect(s.movingTimeMs / 1000).toBeLessThan(42);
    expect(getAverageSpeed(s)).toBeGreaterThan(9.5);
  });
});

describe('outlier filtering', () => {
  it('ignores a coordinate jump', () => {
    const pts = track(Array(10).fill(10));
    const glitch: GPSPoint = { ...pts[5]!, longitude: pts[5]!.longitude + 500 / METERS_PER_DEG };
    const withGlitch = [...pts.slice(0, 5), glitch, ...pts.slice(6)];
    const s = processPoints(withGlitch);
    expect(s.maxSpeedMps).toBeCloseTo(10, 1);
    expect(s.distanceMeters).toBeCloseTo(100, 0);
    expect(s.rejectedPoints).toBe(1);
  });

  it('ignores an unrealistic device speed spike', () => {
    const pts = track(Array(10).fill(20), { deviceSpeed: true });
    pts[6] = { ...pts[6]!, speed: 90 };
    const s = processPoints(pts);
    expect(s.maxSpeedMps).toBeCloseTo(20, 5);
  });

  it('resyncs after repeated disagreement instead of freezing', () => {
    let s = createSession();
    s = processPoint(s, { latitude: 0, longitude: 0, timestamp: T0, accuracy: 5, speed: 0 }).session;
    const results = [1, 2, 3].map((i) => {
      const r = processPoint(s, { latitude: 0, longitude: 0, timestamp: T0 + i * 1000, accuracy: 5, speed: 60 });
      s = r.session;
      return r.accepted;
    });
    expect(results).toEqual([false, false, true]);
    expect(s.maxSpeedMps).toBe(0); // resync never credits max speed
  });
});

describe('GPS quality handling', () => {
  it('ignores inaccurate fixes for statistics but records accuracy', () => {
    const r = processPoint(createSession(), { latitude: 0, longitude: 0, timestamp: T0, accuracy: 80 });
    expect(r.accepted).toBe(false);
    expect(r.reason).toBe('low-accuracy');
    expect(r.session.lastAccuracy).toBe(80);
    expect(r.session.lastSample).toBeNull();
  });

  it('does not accumulate distance from stationary drift', () => {
    const offsets = [0, 1.5, -1.5, 1, -1, 1.5, 0, -1.5];
    const pts: GPSPoint[] = Array.from({ length: 60 }, (_, i) => ({
      latitude: (offsets[i % offsets.length]! * 0.7) / METERS_PER_DEG,
      longitude: offsets[(i + 3) % offsets.length]! / METERS_PER_DEG,
      timestamp: T0 + i * 1000,
      accuracy: 8,
      speed: null,
    }));
    const s = processPoints(pts);
    expect(s.distanceMeters).toBe(0);
    expect(s.maxSpeedMps).toBe(0);
    expect(s.movingTimeMs).toBe(0);
    expect(s.currentSpeedMps).toBe(0);
  });

  it('rejects duplicate timestamps', () => {
    let s = processPoint(createSession(), { latitude: 0, longitude: 0, timestamp: T0, accuracy: 5 }).session;
    const r = processPoint(s, { latitude: 0, longitude: 0.001, timestamp: T0, accuracy: 5 });
    s = r.session;
    expect(r.reason).toBe('stale');
    expect(s.distanceMeters).toBe(0);
  });

  it('handles null speed values', () => {
    const r = processPoint(createSession(), { latitude: 0, longitude: 0, timestamp: T0, accuracy: 5, speed: null });
    expect(r.accepted).toBe(true);
    expect(r.session.currentSpeedMps).toBe(0);
  });
});

describe('segments', () => {
  it('does not count the gap between stop and resume', () => {
    const first = processPoints(track(Array(10).fill(10)));
    const resumed = beginSegment(first);
    const second = processPoints(track(Array(10).fill(10), { startMeters: 5000, t0: T0 + 600_000 }), DEFAULT_TRACKING_CONFIG, resumed);
    expect(second.distanceMeters).toBeCloseTo(200, 0);
  });
});

describe('session duration timer', () => {
  it('measures running time across segments', () => {
    let t = createTimer();
    t = startTimer(t, 1_000);
    expect(getElapsed(t, 4_000)).toBe(3_000);
    t = stopTimer(t, 6_000);
    expect(getElapsed(t, 99_000)).toBe(5_000);
    t = startTimer(t, 10_000);
    expect(getElapsed(t, 12_000)).toBe(7_000);
  });

  it('ignores redundant start/stop calls', () => {
    let t = startTimer(createTimer(), 1_000);
    t = startTimer(t, 5_000);
    expect(getElapsed(t, 6_000)).toBe(5_000);
    t = stopTimer(stopTimer(t, 6_000), 9_000);
    expect(t.accumulatedMs).toBe(5_000);
  });
});
