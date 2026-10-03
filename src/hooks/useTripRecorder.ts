/**
 * Trip recording lifecycle hook.
 *
 * Observes the GPS tracking engine and:
 * 1. On start: creates an in-memory draft.
 * 2. While tracking: periodically persists the draft to IndexedDB.
 * 3. On stop: finalizes and saves a complete Trip.
 * 4. On mount: checks for an unfinished draft (crash recovery).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { DRAFT_SAVE_INTERVAL_MS, ELEVATION_THRESHOLD_METERS } from '../constants/storage';
import { deleteDraft, getDraft, saveDraft, saveTrip } from '../storage/tripStore';
import type { TrackPoint, TrackingSession } from '../types/gps';
import type { Trip, TripDraft } from '../types/trip';
import { computeElevation } from '../utils/elevation';
import { getAverageSpeed } from '../utils/session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function defaultTripName(startedAt: number): string {
  const d = new Date(startedAt);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const year = d.getFullYear();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `Trip — ${day} ${month} ${year}, ${time}`;
}

function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  // Fallback for older browsers
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function buildTrip(
  id: string,
  name: string,
  startedAt: number,
  endedAt: number,
  durationMs: number,
  session: TrackingSession,
  points: TrackPoint[],
): Trip {
  const first = points[0];
  const last = points[points.length - 1];
  const elev = computeElevation(points, ELEVATION_THRESHOLD_METERS);

  return {
    id,
    name,
    startedAt,
    endedAt,
    durationMs,
    movingTimeMs: session.movingTimeMs,
    distanceMeters: session.distanceMeters,
    averageSpeedMps: getAverageSpeed(session),
    maxSpeedMps: session.maxSpeedMps,
    pointCount: points.length,
    startLat: first?.latitude ?? 0,
    startLng: first?.longitude ?? 0,
    endLat: last?.latitude ?? 0,
    endLng: last?.longitude ?? 0,
    elevationGainMeters: elev?.gainMeters ?? null,
    elevationLossMeters: elev?.lossMeters ?? null,
    highestAltitudeMeters: elev?.highestMeters ?? null,
    lowestAltitudeMeters: elev?.lowestMeters ?? null,
    points,
  };
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface RecoveredDraft {
  draft: TripDraft;
}

export interface TripRecorderState {
  /** A draft was found from a previous crash. */
  recovered: RecoveredDraft | null;
  /** The trip that was just saved (for toast display). */
  lastSaved: Trip | null;
  /** Accept or discard a recovered draft. */
  acceptRecovery: () => void;
  discardRecovery: () => void;
  /** Clear the "saved" notification. */
  dismissSaved: () => void;
}

export function useTripRecorder(
  isTracking: boolean,
  session: TrackingSession,
  duration: number,
  trackPoints: TrackPoint[],
): TripRecorderState {
  const [recovered, setRecovered] = useState<RecoveredDraft | null>(null);
  const [lastSaved, setLastSaved] = useState<Trip | null>(null);

  const draftRef = useRef<{ id: string; name: string; startedAt: number } | null>(null);
  const wasTrackingRef = useRef(false);
  const sessionRef = useRef(session);
  const pointsRef = useRef(trackPoints);
  const durationRef = useRef(duration);

  // Keep refs fresh so the interval callback sees current values.
  sessionRef.current = session;
  pointsRef.current = trackPoints;
  durationRef.current = duration;

  // ---- Check for recovered draft on mount --------------------------------
  useEffect(() => {
    getDraft().then((draft) => {
      if (draft && draft.points.length > 0) {
        setRecovered({ draft });
      }
    }).catch(() => { /* IDB unavailable */ });
  }, []);

  const acceptRecovery = useCallback(() => {
    // The recovered draft's points will be loaded by the parent into the
    // tracking engine. For now just clear the UI prompt; the parent
    // should read `recovered.draft` before this is called.
    setRecovered(null);
  }, []);

  const discardRecovery = useCallback(() => {
    setRecovered(null);
    deleteDraft().catch(() => { /* ignore */ });
  }, []);

  const dismissSaved = useCallback(() => setLastSaved(null), []);

  // ---- Tracking started → create draft -----------------------------------
  useEffect(() => {
    if (isTracking && !wasTrackingRef.current) {
      const startedAt = Date.now();
      const id = generateId();
      const name = defaultTripName(startedAt);
      draftRef.current = { id, name, startedAt };
    }
    wasTrackingRef.current = isTracking;
  }, [isTracking]);

  // ---- Periodic draft save -----------------------------------------------
  useEffect(() => {
    if (!isTracking) return;
    const handle = window.setInterval(() => {
      const info = draftRef.current;
      if (!info) return;
      const draft: TripDraft = {
        id: info.id,
        name: info.name,
        startedAt: info.startedAt,
        points: pointsRef.current,
        distanceMeters: sessionRef.current.distanceMeters,
        movingTimeMs: sessionRef.current.movingTimeMs,
        maxSpeedMps: sessionRef.current.maxSpeedMps,
        savedAt: Date.now(),
      };
      saveDraft(draft).catch(() => { /* IDB unavailable */ });
    }, DRAFT_SAVE_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [isTracking]);

  // ---- Tracking stopped → finalize trip ----------------------------------
  useEffect(() => {
    if (!isTracking && wasTrackingRef.current) {
      // wasTrackingRef was already set to false in the earlier effect,
      // so we rely on this running after the tracking flag flips.
    }
    // This effect intentionally doesn't track wasTrackingRef.
    // We handle stop detection below via a separate ref.
  }, [isTracking]);

  // Separate stop-detection that fires once on the transition.
  const prevTrackingRef = useRef(isTracking);
  useEffect(() => {
    const wasPrev = prevTrackingRef.current;
    prevTrackingRef.current = isTracking;

    if (wasPrev && !isTracking) {
      const info = draftRef.current;
      const pts = pointsRef.current;
      if (!info || pts.length === 0) {
        // Nothing to save.
        deleteDraft().catch(() => {});
        draftRef.current = null;
        return;
      }

      const endedAt = Date.now();
      const trip = buildTrip(
        info.id,
        info.name,
        info.startedAt,
        endedAt,
        durationRef.current,
        sessionRef.current,
        pts,
      );

      saveTrip(trip)
        .then(() => {
          setLastSaved(trip);
          return deleteDraft();
        })
        .catch(() => { /* IDB unavailable */ });

      draftRef.current = null;
    }
  }, [isTracking]);

  return { recovered, lastSaved, acceptRecovery, discardRecovery, dismissSaved };
}
