import { useCallback, useEffect, useRef, useState } from 'react';
import { saveDraft, getDraft, deleteDraft, saveTrip } from '../storage/db';
import type { TrackPoint, TrackingSession } from '@gps/core';
import type { Trip, TripDraft } from '@gps/core';
import { computeElevation, getAverageSpeed } from '@gps/core';
import * as Crypto from 'expo-crypto';

const DRAFT_SAVE_INTERVAL_MS = 5000;
const ELEVATION_THRESHOLD_METERS = 5;

function defaultTripName(startedAt: number): string {
  const d = new Date(startedAt);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const year = d.getFullYear();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `Trip — ${day} ${month} ${year}, ${time}`;
}

function generateId(): string {
  return Crypto.randomUUID();
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

export interface RecoveredDraft {
  draft: TripDraft;
}

export interface TripRecorderState {
  recovered: RecoveredDraft | null;
  lastSaved: Trip | null;
  acceptRecovery: () => void;
  discardRecovery: () => void;
  dismissSaved: () => void;
}

export function useNativeTripRecorder(
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

  sessionRef.current = session;
  pointsRef.current = trackPoints;
  durationRef.current = duration;

  useEffect(() => {
    try {
      const draft = getDraft();
      if (draft && draft.points && draft.points.length > 0) {
        setRecovered({ draft });
      }
    } catch (e) {}
  }, []);

  const acceptRecovery = useCallback(() => {
    setRecovered(null);
  }, []);

  const discardRecovery = useCallback(() => {
    setRecovered(null);
    try {
      deleteDraft();
    } catch (e) {}
  }, []);

  const dismissSaved = useCallback(() => setLastSaved(null), []);

  useEffect(() => {
    if (isTracking && !wasTrackingRef.current) {
      const startedAt = Date.now();
      const id = generateId();
      const name = defaultTripName(startedAt);
      draftRef.current = { id, name, startedAt };
    }
    wasTrackingRef.current = isTracking;
  }, [isTracking]);

  useEffect(() => {
    if (!isTracking) return;
    const handle = setInterval(() => {
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
      try {
        saveDraft(draft);
      } catch (e) {}
    }, DRAFT_SAVE_INTERVAL_MS);
    return () => clearInterval(handle);
  }, [isTracking]);

  const prevTrackingRef = useRef(isTracking);
  useEffect(() => {
    const wasPrev = prevTrackingRef.current;
    prevTrackingRef.current = isTracking;

    if (wasPrev && !isTracking) {
      const info = draftRef.current;
      const pts = pointsRef.current;
      if (!info || pts.length === 0) {
        try { deleteDraft(); } catch (e) {}
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

      try {
        saveTrip(trip);
        setLastSaved(trip);
        deleteDraft();
      } catch (e) {
        console.error("Failed to save trip", e);
      }

      draftRef.current = null;
    }
  }, [isTracking]);

  return { recovered, lastSaved, acceptRecovery, discardRecovery, dismissSaved };
}
