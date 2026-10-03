/**
 * Pure, platform-agnostic session statistics engine.
 *
 * Feed it GPS points (from the browser, Expo Location, a file, …) and it
 * returns updated statistics. No browser APIs are used here so this module
 * can be extracted into a shared package for the mobile app.
 */
import { DEFAULT_TRACKING_CONFIG } from '../constants/tracking';
import type {
  GPSPoint,
  ProcessResult,
  PointRejectionReason,
  SessionTimer,
  TrackingConfig,
  TrackingSession,
} from '../types/gps';
import { movementThreshold } from './distance';
import { haversineDistance, isValidCoordinate } from './geo';
import { averageSpeed, isSpeedOutlier, smoothSpeed, validDeviceSpeed } from './speed';

export function createSession(): TrackingSession {
  return {
    distanceMeters: 0,
    movingTimeMs: 0,
    maxSpeedMps: 0,
    currentSpeedMps: 0,
    lastRawSpeedMps: 0,
    anchor: null,
    lastSample: null,
    lastAccuracy: null,
    consecutiveRejections: 0,
    acceptedPoints: 0,
    rejectedPoints: 0,
  };
}

/**
 * Start a new tracking segment within the same session (e.g. after stop → start).
 * Clears positional references so the gap between segments is not counted.
 */
export function beginSegment(session: TrackingSession): TrackingSession {
  return {
    ...session,
    anchor: null,
    lastSample: null,
    currentSpeedMps: 0,
    lastRawSpeedMps: 0,
    consecutiveRejections: 0,
  };
}

/** Called when tracking stops: speed drops to zero, stats are preserved. */
export function endSegment(session: TrackingSession): TrackingSession {
  return { ...session, currentSpeedMps: 0, lastRawSpeedMps: 0 };
}

function reject(session: TrackingSession, reason: PointRejectionReason): ProcessResult {
  return {
    session: {
      ...session,
      consecutiveRejections: session.consecutiveRejections + 1,
      rejectedPoints: session.rejectedPoints + 1,
    },
    accepted: false,
    reason,
  };
}

function displaySpeed(previous: number, raw: number, config: TrackingConfig): number {
  const smoothed = smoothSpeed(previous, raw, config.smoothingFactor);
  return smoothed < config.stopSpeedThresholdMps ? 0 : smoothed;
}

/** Process one GPS fix and return the updated session. */
export function processPoint(
  session: TrackingSession,
  point: GPSPoint,
  config: TrackingConfig = DEFAULT_TRACKING_CONFIG,
): ProcessResult {
  if (!isValidCoordinate(point) || !Number.isFinite(point.timestamp)) {
    return reject(session, 'invalid');
  }

  const accuracy = typeof point.accuracy === 'number' ? point.accuracy : null;
  const base: TrackingSession = { ...session, lastAccuracy: accuracy ?? session.lastAccuracy };

  // 1. Quality gate: never let inaccurate fixes affect statistics.
  if (accuracy !== null && accuracy > config.maxAcceptableAccuracy) {
    return reject(base, 'low-accuracy');
  }

  const deviceSpeed = validDeviceSpeed(point.speed);
  const prev = session.lastSample;

  // 2. First fix of a segment: establish reference position.
  if (!prev) {
    const speed =
      deviceSpeed !== null && deviceSpeed <= config.maxPlausibleSpeedMps ? deviceSpeed : 0;
    const moving = speed >= config.stopSpeedThresholdMps;
    return {
      session: {
        ...base,
        anchor: point,
        lastSample: point,
        lastRawSpeedMps: speed,
        currentSpeedMps: moving ? speed : 0,
        maxSpeedMps: moving ? Math.max(base.maxSpeedMps, speed) : base.maxSpeedMps,
        consecutiveRejections: 0,
        acceptedPoints: base.acceptedPoints + 1,
      },
      accepted: true,
    };
  }

  const dtSample = (point.timestamp - prev.timestamp) / 1000;
  if (dtSample <= 0) return reject(base, 'stale');

  const anchor = session.anchor ?? prev;
  const dtAnchor = Math.max((point.timestamp - anchor.timestamp) / 1000, dtSample);
  const dAnchor = haversineDistance(anchor, point);
  const significant = dAnchor >= movementThreshold(anchor.accuracy, point.accuracy, config);

  // 3. Raw speed: prefer device Doppler speed, else displacement over time.
  const rawSpeed = deviceSpeed ?? (significant ? dAnchor / dtAnchor : 0);

  // 4. Outlier protection against GPS jumps / impossible accelerations.
  if (isSpeedOutlier(session.lastRawSpeedMps, rawSpeed, dtSample, config)) {
    if (session.consecutiveRejections + 1 < config.maxConsecutiveRejections) {
      return reject(base, 'outlier');
    }
    // Persistent disagreement: our reference is probably wrong. Resync without
    // crediting distance or max speed.
    const resyncSpeed =
      deviceSpeed !== null && deviceSpeed <= config.maxPlausibleSpeedMps ? deviceSpeed : 0;
    return {
      session: {
        ...base,
        anchor: point,
        lastSample: point,
        lastRawSpeedMps: resyncSpeed,
        currentSpeedMps: displaySpeed(base.currentSpeedMps, resyncSpeed, config),
        consecutiveRejections: 0,
        acceptedPoints: base.acceptedPoints + 1,
      },
      accepted: true,
    };
  }

  const moving = rawSpeed >= config.stopSpeedThresholdMps;
  let { distanceMeters, movingTimeMs, maxSpeedMps } = base;
  let nextAnchor = anchor;

  if (significant && moving) {
    distanceMeters += dAnchor;
    // Time it took to cover the displacement at the measured speed, bounded by
    // the elapsed time. Avoids counting long stops as moving time.
    movingTimeMs += Math.min(dtAnchor, dAnchor / rawSpeed) * 1000;
    nextAnchor = point;
  } else if (!moving && dtAnchor > config.maxAnchorAgeSeconds) {
    // Stationary: refresh the anchor so slow drift can't accumulate.
    nextAnchor = point;
  }

  if (moving) maxSpeedMps = Math.max(maxSpeedMps, rawSpeed);

  return {
    session: {
      ...base,
      distanceMeters,
      movingTimeMs,
      maxSpeedMps,
      currentSpeedMps: displaySpeed(base.currentSpeedMps, rawSpeed, config),
      lastRawSpeedMps: rawSpeed,
      anchor: nextAnchor,
      lastSample: point,
      consecutiveRejections: 0,
      acceptedPoints: base.acceptedPoints + 1,
    },
    accepted: true,
  };
}

/** Process a list of points (useful for tests and replaying recorded tracks). */
export function processPoints(
  points: GPSPoint[],
  config: TrackingConfig = DEFAULT_TRACKING_CONFIG,
  initial: TrackingSession = createSession(),
): TrackingSession {
  return points.reduce((s, p) => processPoint(s, p, config).session, initial);
}

export function getAverageSpeed(session: TrackingSession): number {
  return averageSpeed(session.distanceMeters, session.movingTimeMs);
}

// ---------------------------------------------------------------------------
// Stopwatch (wall-clock session duration)
// ---------------------------------------------------------------------------

export function createTimer(): SessionTimer {
  return { accumulatedMs: 0, runningSince: null };
}

export function startTimer(timer: SessionTimer, now: number): SessionTimer {
  return timer.runningSince !== null ? timer : { ...timer, runningSince: now };
}

export function stopTimer(timer: SessionTimer, now: number): SessionTimer {
  if (timer.runningSince === null) return timer;
  return { accumulatedMs: timer.accumulatedMs + Math.max(0, now - timer.runningSince), runningSince: null };
}

export function getElapsed(timer: SessionTimer, now: number): number {
  return timer.accumulatedMs + (timer.runningSince !== null ? Math.max(0, now - timer.runningSince) : 0);
}
