/**
 * Elevation statistics from GPS altitude readings.
 *
 * GPS altitude is noisy. A configurable dead-band threshold prevents tiny
 * fluctuations from being counted as climbing or descending.
 */
import type { TrackPoint } from './types/gps';

export interface ElevationStats {
  gainMeters: number;
  lossMeters: number;
  highestMeters: number;
  lowestMeters: number;
}

/**
 * Compute elevation gain, loss, highest and lowest points.
 *
 * @param points    Accepted track points (in order).
 * @param threshold Minimum altitude change (m) before it counts. Default 3 m.
 * @returns         Stats, or `null` if fewer than 2 points have altitude data.
 */
export function computeElevation(
  points: TrackPoint[],
  threshold = 3,
): ElevationStats | null {
  // Collect valid altitude readings.
  const altitudes: number[] = [];
  for (const p of points) {
    if (p.altitude !== null && Number.isFinite(p.altitude)) {
      altitudes.push(p.altitude);
    }
  }
  if (altitudes.length < 2) return null;

  let gain = 0;
  let loss = 0;
  let highest = altitudes[0]!;
  let lowest = altitudes[0]!;
  let ref = altitudes[0]!;

  for (let i = 1; i < altitudes.length; i++) {
    const alt = altitudes[i]!;
    if (alt > highest) highest = alt;
    if (alt < lowest) lowest = alt;

    const delta = alt - ref;
    if (Math.abs(delta) >= threshold) {
      if (delta > 0) gain += delta;
      else loss += Math.abs(delta);
      ref = alt;
    }
  }

  return {
    gainMeters: Math.round(gain),
    lossMeters: Math.round(loss),
    highestMeters: Math.round(highest),
    lowestMeters: Math.round(lowest),
  };
}
