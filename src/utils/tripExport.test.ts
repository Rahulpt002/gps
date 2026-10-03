import { describe, it, expect } from 'vitest';
import { generateTripJSON, parseTripJSON } from './tripExport';
import type { Trip } from '../types/trip';

const mockTrip: Trip = {
  id: '123',
  name: 'Test Trip',
  startedAt: 1000000,
  endedAt: 1005000,
  durationMs: 5000,
  movingTimeMs: 4000,
  distanceMeters: 100,
  averageSpeedMps: 25,
  maxSpeedMps: 30,
  pointCount: 2,
  startLat: 10,
  startLng: 20,
  endLat: 10.001,
  endLng: 20.001,
  elevationGainMeters: 10,
  elevationLossMeters: 5,
  highestAltitudeMeters: 100,
  lowestAltitudeMeters: 90,
  points: [
    { latitude: 10, longitude: 20, timestamp: 1000000, speed: 25, accuracy: 5, altitude: 90, heading: 0, segment: 0 },
    { latitude: 10.001, longitude: 20.001, timestamp: 1005000, speed: 30, accuracy: 5, altitude: 100, heading: 0, segment: 0 },
  ],
};

describe('Trip JSON Export/Import', () => {
  it('round-trips a valid trip correctly', () => {
    const json = generateTripJSON(mockTrip);
    const parsed = parseTripJSON(json);

    // ID is regenerated on import, so we shouldn't expect it to match.
    expect(parsed.name).toBe(mockTrip.name);
    expect(parsed.startedAt).toBe(mockTrip.startedAt);
    expect(parsed.distanceMeters).toBe(mockTrip.distanceMeters);
    expect(parsed.points.length).toBe(mockTrip.points.length);
    expect(parsed.points[0]!.latitude).toBe(mockTrip.points[0]!.latitude);
  });

  it('rejects invalid JSON', () => {
    expect(() => parseTripJSON('not json')).toThrow('Invalid JSON file');
  });

  it('rejects JSON without points', () => {
    expect(() => parseTripJSON('{"version": 1, "trip": {}}')).toThrow('Trip contains no track points');
    expect(() => parseTripJSON('{"version": 1, "trip": {"points": []}}')).toThrow('Trip contains no track points');
  });

  it('rejects invalid points', () => {
    const badData = { version: 1, trip: { points: [{ lat: 'string' }] } };
    expect(() => parseTripJSON(JSON.stringify(badData))).toThrow('Track points have invalid format');
  });
});
