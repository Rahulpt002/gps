import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import {
  DEFAULT_TRACKING_CONFIG,
  SIGNAL_STALE_AFTER_MS,
  UI_TICK_MS,
} from '@gps/core';
import type {
  AccuracyQuality,
  GPSError,
  GPSPoint,
  PermissionState,
  TrackingConfig,
  TrackingSession,
  TrackingStatus,
  TrackPoint,
} from '@gps/core';
import {
  beginSegment,
  createSession,
  createTimer,
  endSegment,
  getAverageSpeed,
  getElapsed,
  processPoint,
  startTimer,
  stopTimer,
  getAccuracyQuality,
} from '@gps/core';

export interface GPSTracking {
  isTracking: boolean;
  currentSpeed: number;
  maxSpeed: number;
  averageSpeed: number;
  distance: number;
  duration: number;
  movingTime: number;
  accuracy: number | null;
  accuracyQuality: AccuracyQuality;
  gpsStatus: TrackingStatus;
  error: GPSError | null;
  permission: PermissionState;
  isSupported: boolean;
  isSignalStale: boolean;
  hasData: boolean;
  session: TrackingSession;
  trackPoints: TrackPoint[];
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
}

export function useNativeGPSTracking(config: TrackingConfig = DEFAULT_TRACKING_CONFIG): GPSTracking {
  const [session, setSession] = useState<TrackingSession>(createSession);
  const [timer, setTimer] = useState(createTimer);
  const [now, setNow] = useState(() => Date.now());
  const [isTracking, setIsTracking] = useState(false);
  const [status, setStatus] = useState<TrackingStatus>('ready');
  const [error, setError] = useState<GPSError | null>(null);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [segmentStartedAt, setSegmentStartedAt] = useState<number | null>(null);

  const sessionRef = useRef(session);
  const locationSubRef = useRef<Location.LocationSubscription | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const commit = useCallback((next: TrackingSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  const clearWatch = useCallback(() => {
    if (locationSubRef.current) {
      locationSubRef.current.remove();
      locationSubRef.current = null;
    }
  }, []);

  const halt = useCallback(() => {
    clearWatch();
    const t = Date.now();
    setIsTracking(false);
    setTimer((prev) => stopTimer(prev, t));
    setLastFixAt(null);
    setSegmentStartedAt(null);
    commit(endSegment(sessionRef.current));
  }, [clearWatch, commit]);

  const handlePosition = useCallback(
    (loc: Location.LocationObject) => {
      const gpsPoint: GPSPoint = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
        accuracy: loc.coords.accuracy ?? undefined,
        speed: loc.coords.speed,
        altitude: loc.coords.altitude,
        heading: loc.coords.heading,
        timestamp: loc.timestamp,
      };
      
      const result = processPoint(sessionRef.current, gpsPoint, configRef.current);
      commit(result.session);
      setLastFixAt(Date.now());
      setPermission('granted');
      setError(null);
      setStatus(result.reason === 'low-accuracy' ? 'weak' : 'tracking');
    },
    [commit],
  );

  const startTracking = useCallback(async () => {
    if (locationSubRef.current) return;
    
    const { status: permStatus } = await Location.getForegroundPermissionsAsync();
    if (permStatus !== 'granted') {
      setPermission('denied');
      setError({ kind: 'permission-denied', message: 'Permission denied' });
      return;
    }

    const t = Date.now();
    commit(beginSegment(sessionRef.current));
    setError(null);
    setStatus('acquiring');
    setIsTracking(true);
    setLastFixAt(null);
    setSegmentStartedAt(t);
    setNow(t);
    setTimer((prev) => startTimer(prev, t));
    
    locationSubRef.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
      },
      handlePosition
    );

    const { status: bgStatus } = await Location.getBackgroundPermissionsAsync();
    if (bgStatus === 'granted') {
      await Location.startLocationUpdatesAsync('BACKGROUND_LOCATION_TASK', {
        accuracy: Location.Accuracy.BestForNavigation,
        timeInterval: 1000,
        distanceInterval: 1,
        showsBackgroundLocationIndicator: true,
        foregroundService: {
          notificationTitle: "GPS Tracker",
          notificationBody: "Tracking your trip...",
          notificationColor: "#208AEF",
        }
      });
    }
  }, [commit, handlePosition]);

  const stopTracking = useCallback(async () => {
    if (!locationSubRef.current) return;
    halt();
    setStatus('ready');
    setError(null);
    try {
      const hasTask = await Location.hasStartedLocationUpdatesAsync('BACKGROUND_LOCATION_TASK');
      if (hasTask) {
        await Location.stopLocationUpdatesAsync('BACKGROUND_LOCATION_TASK');
      }
    } catch (e) {}
  }, [halt]);

  const resetTracking = useCallback(() => {
    const t = Date.now();
    const tracking = locationSubRef.current !== null;
    commit(createSession());
    setTimer(tracking ? startTimer(createTimer(), t) : createTimer());
    setNow(t);
  }, [commit]);

  // Tick the clock while tracking so duration / staleness update.
  useEffect(() => {
    if (!isTracking) return;
    const id = setInterval(() => setNow(Date.now()), UI_TICK_MS);
    return () => clearInterval(id);
  }, [isTracking]);

  // Stop watching on unmount.
  useEffect(() => clearWatch, [clearWatch]);

  const reference = lastFixAt ?? segmentStartedAt;
  const isSignalStale = isTracking && reference !== null && now - reference > SIGNAL_STALE_AFTER_MS;
  const gpsStatus: TrackingStatus =
    isSignalStale && (status === 'tracking' || status === 'acquiring') ? 'weak' : status;

  return {
    isTracking,
    currentSpeed: isSignalStale ? 0 : session.currentSpeedMps,
    maxSpeed: session.maxSpeedMps,
    averageSpeed: getAverageSpeed(session),
    distance: session.distanceMeters,
    duration: getElapsed(timer, now),
    movingTime: session.movingTimeMs,
    accuracy: session.lastAccuracy,
    accuracyQuality: getAccuracyQuality(session.lastAccuracy),
    gpsStatus,
    error,
    permission,
    isSupported: true,
    isSignalStale,
    hasData: session.acceptedPoints > 0 || timer.accumulatedMs > 0 || timer.runningSince !== null,
    session,
    trackPoints: session.trackPoints,
    startTracking,
    stopTracking,
    resetTracking,
  };
}
