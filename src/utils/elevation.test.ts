import { describe, it, expect } from 'vitest';
import { computeElevation } from './elevation';
import type { TrackPoint } from '../types/gps';

function pt(altitude: number | null): TrackPoint {
  return { altitude } as TrackPoint;
}

describe('computeElevation', () => {
  it('returns null for insufficient valid data', () => {
    expect(computeElevation([])).toBeNull();
    expect(computeElevation([pt(100)])).toBeNull();
    expect(computeElevation([pt(100), pt(null)])).toBeNull();
  });

  it('computes basic gain and loss', () => {
    // A climb from 100 to 150 (gain 50), then drop to 120 (loss 30)
    const points = [pt(100), pt(120), pt(150), pt(120)];
    const stats = computeElevation(points, 0);
    expect(stats?.gainMeters).toBe(50);
    expect(stats?.lossMeters).toBe(30);
    expect(stats?.highestMeters).toBe(150);
    expect(stats?.lowestMeters).toBe(100);
  });

  it('ignores changes below the noise threshold', () => {
    // Fluctuation of 2m should be ignored with threshold 3m
    const points = [pt(100), pt(102), pt(98), pt(100)];
    const stats = computeElevation(points, 3);
    expect(stats?.gainMeters).toBe(0);
    expect(stats?.lossMeters).toBe(0);
    expect(stats?.highestMeters).toBe(102);
    expect(stats?.lowestMeters).toBe(98);
  });

  it('handles nulls mixed with valid readings', () => {
    const points = [pt(100), pt(null), pt(150), pt(null), pt(120)];
    const stats = computeElevation(points, 0);
    expect(stats?.gainMeters).toBe(50);
    expect(stats?.lossMeters).toBe(30);
  });
});
