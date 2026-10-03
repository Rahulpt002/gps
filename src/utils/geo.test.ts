import { describe, expect, it } from 'vitest';
import { haversineDistance, isValidCoordinate } from './geo';
import { convertDistance, movementThreshold } from './distance';
import { DEFAULT_TRACKING_CONFIG } from '../constants/tracking';

describe('haversineDistance', () => {
  it('returns 0 for identical points', () => {
    const p = { latitude: 11.2588, longitude: 75.7804 };
    expect(haversineDistance(p, p)).toBe(0);
  });

  it('measures one degree of latitude ≈ 111.195 km', () => {
    const d = haversineDistance({ latitude: 0, longitude: 0 }, { latitude: 1, longitude: 0 });
    expect(d).toBeCloseTo(111195, -1);
  });

  it('measures Paris → London ≈ 343.5 km', () => {
    const paris = { latitude: 48.8566, longitude: 2.3522 };
    const london = { latitude: 51.5074, longitude: -0.1278 };
    expect(haversineDistance(paris, london) / 1000).toBeCloseTo(343.5, 0);
  });

  it('measures the plan example (Kozhikode) ≈ 109 m', () => {
    const a = { latitude: 11.2588, longitude: 75.7804 };
    const b = { latitude: 11.2595, longitude: 75.7811 };
    expect(haversineDistance(a, b)).toBeGreaterThan(108);
    expect(haversineDistance(a, b)).toBeLessThan(110);
  });

  it('is symmetric', () => {
    const a = { latitude: -33.8688, longitude: 151.2093 };
    const b = { latitude: 35.6762, longitude: 139.6503 };
    expect(haversineDistance(a, b)).toBeCloseTo(haversineDistance(b, a), 6);
  });

  it('handles the antimeridian', () => {
    const d = haversineDistance({ latitude: 0, longitude: 179.9995 }, { latitude: 0, longitude: -179.9995 });
    expect(d).toBeCloseTo(111.2, 0);
  });
});

describe('isValidCoordinate', () => {
  it('rejects out-of-range and NaN values', () => {
    expect(isValidCoordinate({ latitude: 91, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 0, longitude: 181 })).toBe(false);
    expect(isValidCoordinate({ latitude: NaN, longitude: 0 })).toBe(false);
    expect(isValidCoordinate({ latitude: 45, longitude: 90 })).toBe(true);
  });
});

describe('distance helpers', () => {
  it('scales movement threshold with accuracy', () => {
    expect(movementThreshold(5, 4, DEFAULT_TRACKING_CONFIG)).toBe(3);
    expect(movementThreshold(20, 8, DEFAULT_TRACKING_CONFIG)).toBe(10);
    expect(movementThreshold(undefined, undefined, DEFAULT_TRACKING_CONFIG)).toBe(3);
  });

  it('converts meters to km / miles', () => {
    expect(convertDistance(12840, 'kmh')).toBeCloseTo(12.84, 5);
    expect(convertDistance(1609.344, 'mph')).toBeCloseTo(1, 6);
  });
});
