import { ACCURACY_THRESHOLDS, MPS_TO_KMH, MPS_TO_MPH } from '../constants/tracking';
import type { AccuracyQuality, AccuracyThresholds, SpeedUnit, TrackingConfig } from '../types/gps';

const FACTORS: Record<SpeedUnit, number> = {
  mps: 1,
  kmh: MPS_TO_KMH,
  mph: MPS_TO_MPH,
};

export const mpsToKmh = (mps: number): number => mps * MPS_TO_KMH;
export const mpsToMph = (mps: number): number => mps * MPS_TO_MPH;

/** Convert a speed in m/s to the given unit. */
export function convertSpeed(mps: number, unit: SpeedUnit): number {
  return mps * FACTORS[unit];
}

/** Convert a speed in the given unit back to m/s. */
export function toMps(value: number, unit: SpeedUnit): number {
  return value / FACTORS[unit];
}

/** Convert between any two speed units. */
export function convertBetween(value: number, from: SpeedUnit, to: SpeedUnit): number {
  return convertSpeed(toMps(value, from), to);
}

/** Speed in m/s from a distance (m) over a duration (s). Returns 0 for non-positive time. */
export function calculateSpeed(distanceMeters: number, seconds: number): number {
  if (!(seconds > 0) || !Number.isFinite(distanceMeters)) return 0;
  return distanceMeters / seconds;
}

/** Returns a usable device-reported speed or null if missing/invalid. */
export function validDeviceSpeed(speed: number | null | undefined): number | null {
  return typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed : null;
}

/**
 * Exponential moving average.
 * `factor` is the weight of the newest reading: smoothed = prev·(1−f) + current·f.
 */
export function smoothSpeed(previous: number, current: number, factor: number): number {
  const f = Math.min(1, Math.max(0, factor));
  return previous * (1 - f) + current * f;
}

/** Apply EMA over a series of readings. */
export function smoothSeries(readings: number[], factor: number): number[] {
  const out: number[] = [];
  let prev: number | undefined;
  for (const r of readings) {
    prev = prev === undefined ? r : smoothSpeed(prev, r, factor);
    out.push(prev);
  }
  return out;
}

/**
 * True when a reading is physically implausible: either faster than the
 * configured ceiling, or the change from the previous reading implies an
 * acceleration no vehicle could achieve.
 */
export function isSpeedOutlier(
  previousMps: number,
  nextMps: number,
  seconds: number,
  config: Pick<TrackingConfig, 'maxPlausibleSpeedMps' | 'maxAccelerationMps2'>,
): boolean {
  if (nextMps > config.maxPlausibleSpeedMps) return true;
  if (!(seconds > 0)) return false;
  return Math.abs(nextMps - previousMps) / seconds > config.maxAccelerationMps2;
}

/** Average speed (m/s) = distance / moving time. */
export function averageSpeed(distanceMeters: number, movingTimeMs: number): number {
  if (movingTimeMs < 1000) return 0;
  return distanceMeters / (movingTimeMs / 1000);
}

export function getAccuracyQuality(
  accuracy: number | null | undefined,
  thresholds: AccuracyThresholds = ACCURACY_THRESHOLDS,
): AccuracyQuality {
  if (accuracy == null || !Number.isFinite(accuracy)) return 'unknown';
  if (accuracy < thresholds.excellent) return 'excellent';
  if (accuracy < thresholds.good) return 'good';
  if (accuracy <= thresholds.fair) return 'fair';
  return 'poor';
}
