/**
 * JSON export and import for trips.
 *
 * Provides a round-trip backup mechanism that preserves full precision,
 * unlike GPX which loses some internal application state.
 */
import type { Trip } from '@gps/core';
import { ELEVATION_THRESHOLD_METERS } from '../constants/storage';
import { computeElevation } from '@gps/core';

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function generateTripJSON(trip: Trip): string {
  // We export exactly what we have, but to be robust against schema changes,
  // we could version this wrapper. For now, a direct stringify is sufficient
  // because the `Trip` type is simple and self-contained.
  const data = {
    version: 1,
    exportedAt: Date.now(),
    trip,
  };
  return JSON.stringify(data, null, 2);
}

export function downloadTripJSON(trip: Trip): void {
  const json = generateTripJSON(trip);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const d = new Date(trip.startedAt);
  const pad = (n: number) => String(n).padStart(2, '0');
  const filename = `gps-trip-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}.json`;
  
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------

/**
 * Validate and import a JSON string.
 * Performs runtime checks to ensure the parsed object matches the `Trip` shape.
 */
export function parseTripJSON(jsonString: string): Trip {
  let parsed: any;
  try {
    parsed = JSON.parse(jsonString);
  } catch (e) {
    throw new Error('Invalid JSON file');
  }

  // Handle our version wrapper or a direct raw dump.
  const rawTrip = parsed.version === 1 ? parsed.trip : parsed;
  if (!rawTrip || typeof rawTrip !== 'object') {
    throw new Error('Invalid trip data format');
  }

  // Validate points array
  if (!Array.isArray(rawTrip.points) || rawTrip.points.length === 0) {
    throw new Error('Trip contains no track points');
  }

  const points = rawTrip.points;
  // Basic validation of the first point to ensure shape
  const pt0 = points[0];
  if (
    typeof pt0.latitude !== 'number' ||
    typeof pt0.longitude !== 'number' ||
    typeof pt0.timestamp !== 'number' ||
    typeof pt0.speed !== 'number' ||
    typeof pt0.segment !== 'number'
  ) {
    throw new Error('Track points have invalid format');
  }

  // We could trust the metadata in `rawTrip`, but it's safer to re-derive
  // it from the points to ensure internal consistency (especially for imported data).
  
  const startedAt = points[0].timestamp;
  const endedAt = points[points.length - 1].timestamp;
  const durationMs = endedAt - startedAt;

  // We trust the original name, otherwise generate one.
  const name = typeof rawTrip.name === 'string' && rawTrip.name.trim() 
    ? rawTrip.name.trim() 
    : `Imported Trip — ${new Date(startedAt).toLocaleDateString()}`;

  // If the JSON had computed stats, we could reuse them, but recomputing
  // ensures we don't import corrupted aggregates.
  // Note: For JSON imports from this app, we trust the `distanceMeters` and
  // `movingTimeMs` from the JSON if they exist and are numbers, because they
  // account for GPS accuracy gating that we can't perfectly reconstruct just
  // from the accepted points.

  const distanceMeters = typeof rawTrip.distanceMeters === 'number' 
    ? rawTrip.distanceMeters 
    : 0; // Fallback could compute from haversine
    
  const movingTimeMs = typeof rawTrip.movingTimeMs === 'number'
    ? rawTrip.movingTimeMs
    : durationMs;
    
  const maxSpeedMps = typeof rawTrip.maxSpeedMps === 'number'
    ? rawTrip.maxSpeedMps
    : Math.max(...points.map((p: any) => (typeof p.speed === 'number' ? p.speed : 0)));

  const averageSpeedMps = movingTimeMs > 1000 ? distanceMeters / (movingTimeMs / 1000) : 0;

  const elev = computeElevation(points, ELEVATION_THRESHOLD_METERS);

  // Generate a new ID to avoid collisions if imported multiple times.
  const id = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    name,
    startedAt,
    endedAt,
    durationMs,
    movingTimeMs,
    distanceMeters,
    averageSpeedMps,
    maxSpeedMps,
    pointCount: points.length,
    startLat: points[0].latitude,
    startLng: points[0].longitude,
    endLat: points[points.length - 1].latitude,
    endLng: points[points.length - 1].longitude,
    elevationGainMeters: elev?.gainMeters ?? null,
    elevationLossMeters: elev?.lossMeters ?? null,
    highestAltitudeMeters: elev?.highestMeters ?? null,
    lowestAltitudeMeters: elev?.lowestMeters ?? null,
    points,
  };
}
