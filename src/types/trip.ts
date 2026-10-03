/**
 * Persistent trip data model.
 *
 * All speeds are in m/s, distances in meters, times in milliseconds.
 * Unit conversion happens at display time via existing `convertSpeed()`.
 */
import type { TrackPoint } from './gps';

/** Lightweight summary stored alongside the full trip, used for list views. */
export interface TripMeta {
  /** Unique identifier (crypto.randomUUID). */
  id: string;
  /** User-editable name. Default: "Trip — 4 Oct 2026, 14:32". */
  name: string;
  /** Epoch ms when tracking started. */
  startedAt: number;
  /** Epoch ms when tracking stopped. */
  endedAt: number;
  /** Wall-clock duration (ms). */
  durationMs: number;
  /** Time spent above the stop-speed threshold (ms). */
  movingTimeMs: number;
  /** Total accepted distance (meters). */
  distanceMeters: number;
  /** Average speed over moving time (m/s). */
  averageSpeedMps: number;
  /** Peak accepted speed (m/s). */
  maxSpeedMps: number;
  /** Number of accepted TrackPoints. */
  pointCount: number;
  /** First point coordinates. */
  startLat: number;
  startLng: number;
  /** Last point coordinates. */
  endLat: number;
  endLng: number;
  /** Elevation statistics (null if altitude data unavailable). */
  elevationGainMeters: number | null;
  elevationLossMeters: number | null;
  highestAltitudeMeters: number | null;
  lowestAltitudeMeters: number | null;
}

/** Complete trip record stored in IndexedDB. */
export interface Trip extends TripMeta {
  /** Full-resolution accepted track points. */
  points: TrackPoint[];
}

/**
 * In-progress trip persisted periodically for crash recovery.
 * Stored under a well-known key in the `drafts` store.
 */
export interface TripDraft {
  id: string;
  name: string;
  startedAt: number;
  points: TrackPoint[];
  /** Session statistics snapshot for restoration. */
  distanceMeters: number;
  movingTimeMs: number;
  maxSpeedMps: number;
  /** Timestamp of the last periodic save. */
  savedAt: number;
}

/** Route for navigation. */
export type AppRoute =
  | { page: 'track' }
  | { page: 'trips' }
  | { page: 'trip'; id: string }
  | { page: 'replay'; id: string }
  | { page: 'settings' };
