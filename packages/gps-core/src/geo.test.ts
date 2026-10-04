import { describe, it, expect } from 'vitest';
import { haversineDistance } from './geo';

describe('haversineDistance', () => {
  it('calculates distance between two points correctly', () => {
    // New York to London
    const p1 = { latitude: 40.7128, longitude: -74.0060 };
    const p2 = { latitude: 51.5074, longitude: -0.1278 };
    const distance = haversineDistance(p1, p2);
    // distance should be ~5570km
    expect(distance).toBeGreaterThan(5500000);
    expect(distance).toBeLessThan(5600000);
  });

  it('returns 0 for the same point', () => {
    const p1 = { latitude: 40.7128, longitude: -74.0060 };
    expect(haversineDistance(p1, p1)).toBe(0);
  });
});
