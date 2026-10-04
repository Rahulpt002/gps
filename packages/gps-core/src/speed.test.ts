import { describe, it, expect } from 'vitest';
import { smoothSpeed, calculateSpeed } from './speed';

describe('speed', () => {
  it('smoothSpeed applies EMA correctly', () => {
    expect(smoothSpeed(0, 10, 0.5)).toBe(5);
    expect(smoothSpeed(5, 10, 0.1)).toBe(5.5);
  });

  it('calculateSpeed calculates speed from distance and time', () => {
    // 0.0001 degrees lat is ~11.132 meters. 1 second diff => ~11.132 m/s
    const distance = 11.132; 
    const speed = calculateSpeed(distance, 1);
    expect(speed).toBeCloseTo(11.132, 2);
  });

  it('calculateSpeed returns 0 for same timestamp', () => {
    expect(calculateSpeed(10, 0)).toBe(0);
  });
});
