import { describe, expect, it } from 'vitest';
import { DEFAULT_TRACKING_CONFIG } from '../constants/tracking';
import {
  averageSpeed,
  calculateSpeed,
  convertBetween,
  convertSpeed,
  getAccuracyQuality,
  isSpeedOutlier,
  mpsToKmh,
  mpsToMph,
  smoothSeries,
  smoothSpeed,
  toMps,
} from './speed';
import { formatDuration } from './format';

describe('speed conversion', () => {
  it('converts m/s to km/h', () => {
    expect(mpsToKmh(1)).toBeCloseTo(3.6, 10);
    expect(mpsToKmh(10)).toBeCloseTo(36, 10);
    expect(convertSpeed(10, 'kmh')).toBeCloseTo(36, 10);
  });

  it('converts m/s to mph', () => {
    expect(mpsToMph(1)).toBeCloseTo(2.236936, 6);
    expect(convertSpeed(26.8224, 'mph')).toBeCloseTo(60, 3);
  });

  it('leaves m/s unchanged', () => {
    expect(convertSpeed(12.5, 'mps')).toBe(12.5);
  });

  it('computes speed from distance and time', () => {
    expect(calculateSpeed(100, 10)).toBe(10);
    expect(calculateSpeed(100, 0)).toBe(0);
    expect(calculateSpeed(100, -1)).toBe(0);
  });
});

describe('unit conversion km/h ↔ mph ↔ m/s', () => {
  it('km/h → mph', () => {
    expect(convertBetween(100, 'kmh', 'mph')).toBeCloseTo(62.137, 2);
  });
  it('mph → km/h', () => {
    expect(convertBetween(60, 'mph', 'kmh')).toBeCloseTo(96.56, 1);
  });
  it('km/h → m/s', () => {
    expect(convertBetween(36, 'kmh', 'mps')).toBeCloseTo(10, 10);
    expect(toMps(36, 'kmh')).toBeCloseTo(10, 10);
  });
  it('round-trips through every unit', () => {
    const v = 87.3;
    const back = convertBetween(convertBetween(convertBetween(v, 'kmh', 'mph'), 'mph', 'mps'), 'mps', 'kmh');
    expect(back).toBeCloseTo(v, 9);
  });
});

describe('GPS smoothing', () => {
  it('applies the EMA formula', () => {
    expect(smoothSpeed(50, 60, 0.3)).toBeCloseTo(53, 10);
  });

  it('smooths a series of readings', () => {
    const out = smoothSeries([0, 10, 10, 10], 0.3);
    expect(out[0]).toBe(0);
    expect(out[1]).toBeCloseTo(3, 10);
    expect(out[2]).toBeCloseTo(5.1, 10);
    expect(out[3]).toBeCloseTo(6.57, 10);
  });

  it('dampens a noisy spike', () => {
    const out = smoothSeries([20, 20, 40, 20, 20], 0.3);
    expect(Math.max(...out)).toBeLessThan(27);
  });

  it('clamps the factor to [0, 1]', () => {
    expect(smoothSpeed(10, 20, 2)).toBe(20);
    expect(smoothSpeed(10, 20, -1)).toBe(10);
  });
});

describe('outlier detection', () => {
  const cfg = DEFAULT_TRACKING_CONFIG;

  it('accepts realistic acceleration', () => {
    expect(isSpeedOutlier(20, 25, 1, cfg)).toBe(false); // 5 m/s²
  });

  it('rejects impossible acceleration', () => {
    expect(isSpeedOutlier(15, 60, 1, cfg)).toBe(true); // 45 m/s²
  });

  it('rejects speeds above the plausible ceiling', () => {
    expect(isSpeedOutlier(97, 120, 30, cfg)).toBe(true);
  });

  it('allows larger changes over longer gaps', () => {
    expect(isSpeedOutlier(0, 30, 5, cfg)).toBe(false); // 6 m/s²
  });
});

describe('averageSpeed / accuracy quality / format', () => {
  it('computes distance over moving time', () => {
    expect(averageSpeed(1000, 100_000)).toBe(10);
    expect(averageSpeed(5, 0)).toBe(0);
  });

  it('classifies accuracy', () => {
    expect(getAccuracyQuality(5)).toBe('excellent');
    expect(getAccuracyQuality(10)).toBe('good');
    expect(getAccuracyQuality(30)).toBe('fair');
    expect(getAccuracyQuality(50)).toBe('fair');
    expect(getAccuracyQuality(51)).toBe('poor');
    expect(getAccuracyQuality(null)).toBe('unknown');
  });

  it('formats durations', () => {
    expect(formatDuration(0)).toBe('00:00:00');
    expect(formatDuration((27 * 60 + 42) * 1000)).toBe('00:27:42');
    expect(formatDuration(3_725_000)).toBe('01:02:05');
  });
});
