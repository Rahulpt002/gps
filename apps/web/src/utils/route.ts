/**
 * Pure route/visualisation helpers operating on ACCEPTED track points.
 *
 * Nothing here re-measures anything: distances/speeds come from the session
 * engine. These functions only group, colour, simplify (for rendering) and
 * look up samples. No browser or Leaflet APIs, so they're reusable on mobile.
 */
import { SPEED_CATEGORIES } from '@gps/core';
import type { SpeedCategory, TrackPoint } from '@gps/core';
import { haversineDistance } from '@gps/core';

export type LatLngTuple = [number, number];

/** Category for a speed in m/s. */
export function getSpeedCategory(speedMps: number, categories: SpeedCategory[] = SPEED_CATEGORIES): SpeedCategory {
  const v = Number.isFinite(speedMps) ? Math.max(0, speedMps) : 0;
  for (const c of categories) {
    if (v >= c.minMps && (c.maxMps === null || v < c.maxMps)) return c;
  }
  return categories[categories.length - 1]!;
}

export interface RouteSegment {
  /** Stable key: `${segment}:${startIndex}`. */
  key: string;
  category: SpeedCategory['key'];
  color: string;
  /** Route segment id (breaks at stop/resume or resync). */
  segment: number;
  /** Index (into the track) of the first and last sample in this run. */
  startIndex: number;
  endIndex: number;
  /** Indices of samples used for drawing (all, or a simplified subset). */
  indices: number[];
  positions: LatLngTuple[];
}

export interface BuildRouteOptions {
  categories?: SpeedCategory[];
  /** If set, simplify each run's geometry (rendering only) to this tolerance. */
  simplifyToleranceMeters?: number;
}

/**
 * Split the track into coloured polylines.
 *
 * The line A→B is coloured by the speed measured at B: for derived speeds that
 * value *is* the measurement over A→B, and for device speeds it is the reading
 * on arrival. Consecutive lines with the same colour are merged into one run
 * to keep layer count low. Lines are never drawn across segment breaks.
 */
export function buildRouteSegments(points: TrackPoint[], options: BuildRouteOptions = {}): RouteSegment[] {
  const categories = options.categories ?? SPEED_CATEGORIES;
  const runs: RouteSegment[] = [];
  let run: RouteSegment | null = null;

  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    if (a.segment !== b.segment) {
      run = null;
      continue;
    }
    const cat = getSpeedCategory(b.speed, categories);
    if (run && run.category === cat.key && run.endIndex === i - 1) {
      run.indices.push(i);
      run.endIndex = i;
    } else {
      run = {
        key: `${b.segment}:${i - 1}`,
        category: cat.key,
        color: cat.color,
        segment: b.segment,
        startIndex: i - 1,
        endIndex: i,
        indices: [i - 1, i],
        positions: [],
      };
      runs.push(run);
    }
  }

  const tol = options.simplifyToleranceMeters;
  for (const r of runs) {
    if (tol && tol > 0 && r.indices.length > 2) r.indices = simplifyIndices(points, r.indices, tol);
    r.positions = r.indices.map((i) => [points[i]!.latitude, points[i]!.longitude] as LatLngTuple);
  }
  return runs;
}

/**
 * Reuse previous run objects whose content is unchanged so React/Leaflet
 * skip redrawing them (only the growing tail run updates on each GPS fix).
 */
export function stabilizeSegments(prev: RouteSegment[], next: RouteSegment[]): RouteSegment[] {
  if (prev.length === 0) return next;
  const byKey = new Map(prev.map((s) => [s.key, s]));
  return next.map((s) => {
    const old = byKey.get(s.key);
    return old && old.endIndex === s.endIndex && old.indices.length === s.indices.length && old.color === s.color
      ? old
      : s;
  });
}

/**
 * Douglas–Peucker simplification on a list of track indices (rendering only –
 * the original samples are never modified). Endpoints are always kept.
 */
export function simplifyIndices(points: TrackPoint[], indices: number[], toleranceMeters: number): number[] {
  if (indices.length <= 2) return indices.slice();
  const first = points[indices[0]!]!;
  const cosLat = Math.cos((first.latitude * Math.PI) / 180);
  const M = 111_320;
  const xy = indices.map((i) => {
    const p = points[i]!;
    return [(p.longitude - first.longitude) * M * cosLat, (p.latitude - first.latitude) * M] as const;
  });

  const keep = new Uint8Array(indices.length);
  keep[0] = 1;
  keep[indices.length - 1] = 1;
  const stack: Array<[number, number]> = [[0, indices.length - 1]];

  while (stack.length) {
    const [s, e] = stack.pop()!;
    const [x1, y1] = xy[s]!;
    const [x2, y2] = xy[e]!;
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len2 = dx * dx + dy * dy;
    let maxD = -1;
    let maxI = -1;
    for (let k = s + 1; k < e; k++) {
      const [px, py] = xy[k]!;
      let d: number;
      if (len2 === 0) {
        d = Math.hypot(px - x1, py - y1);
      } else {
        const t = Math.max(0, Math.min(1, ((px - x1) * dx + (py - y1) * dy) / len2));
        d = Math.hypot(px - (x1 + t * dx), py - (y1 + t * dy));
      }
      if (d > maxD) {
        maxD = d;
        maxI = k;
      }
    }
    if (maxI !== -1 && maxD > toleranceMeters) {
      keep[maxI] = 1;
      stack.push([s, maxI], [maxI, e]);
    }
  }
  return indices.filter((_, k) => keep[k] === 1);
}

export interface RouteMarkers {
  start: number | null;
  end: number | null;
  /** Index of the highest accepted speed (first occurrence), null if never moved. */
  max: number | null;
}

export function getRouteMarkers(points: TrackPoint[]): RouteMarkers {
  if (points.length === 0) return { start: null, end: null, max: null };
  let max = -1;
  let maxSpeed = 0;
  for (let i = 0; i < points.length; i++) {
    if (points[i]!.speed > maxSpeed) {
      maxSpeed = points[i]!.speed;
      max = i;
    }
  }
  return { start: 0, end: points.length - 1, max: max === -1 ? null : max };
}

/** Bounding box of all samples as [[south, west], [north, east]], or null. */
export function getTrackBounds(points: TrackPoint[]): [LatLngTuple, LatLngTuple] | null {
  if (points.length === 0) return null;
  let s = Infinity;
  let w = Infinity;
  let n = -Infinity;
  let e = -Infinity;
  for (const p of points) {
    if (p.latitude < s) s = p.latitude;
    if (p.latitude > n) n = p.latitude;
    if (p.longitude < w) w = p.longitude;
    if (p.longitude > e) e = p.longitude;
  }
  return [
    [s, w],
    [n, e],
  ];
}

/** Nearest sample to a coordinate within `maxMeters` (or null). */
export function findNearestPointIndex(
  points: TrackPoint[],
  target: { latitude: number; longitude: number },
  maxMeters = Infinity,
): number | null {
  let best: number | null = null;
  let bestD = maxMeters;
  for (let i = 0; i < points.length; i++) {
    const d = haversineDistance(points[i]!, target);
    if (d <= bestD) {
      bestD = d;
      best = i;
    }
  }
  return best;
}

/** Index of the sample closest in time to `timestamp` (binary search). */
export function findIndexByTime(points: TrackPoint[], timestamp: number): number | null {
  if (points.length === 0) return null;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.timestamp < timestamp) lo = mid + 1;
    else hi = mid;
  }
  if (lo > 0 && Math.abs(points[lo - 1]!.timestamp - timestamp) <= Math.abs(points[lo]!.timestamp - timestamp)) {
    return lo - 1;
  }
  return lo;
}

/**
 * Pick at most ~`maxPoints` indices for drawing a chart, keeping each bucket's
 * min and max speed so peaks are never hidden. Always includes first/last and
 * every segment boundary.
 */
export function downsampleIndices(points: TrackPoint[], maxPoints: number): number[] {
  const n = points.length;
  if (n <= maxPoints) return Array.from({ length: n }, (_, i) => i);
  const buckets = Math.max(1, Math.floor(maxPoints / 2));
  const size = n / buckets;
  const out = new Set<number>([0, n - 1]);
  for (let b = 0; b < buckets; b++) {
    const start = Math.floor(b * size);
    const end = Math.min(n, Math.floor((b + 1) * size));
    let minI = start;
    let maxI = start;
    for (let i = start; i < end; i++) {
      if (points[i]!.speed < points[minI]!.speed) minI = i;
      if (points[i]!.speed > points[maxI]!.speed) maxI = i;
      if (i > 0 && points[i]!.segment !== points[i - 1]!.segment) {
        out.add(i - 1);
        out.add(i);
      }
    }
    out.add(minI);
    out.add(maxI);
  }
  return [...out].sort((a, b) => a - b);
}
