/**
 * Browser adapter around the pure session engine.
 *
 * Only this hook touches `navigator.geolocation`. A React Native version would
 * replace it with an Expo Location adapter while reusing `utils/*` unchanged.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  DEFAULT_TRACKING_CONFIG,
  DEFAULT_WATCH_OPTIONS,
  SIGNAL_STALE_AFTER_MS,
  UI_TICK_MS,
} from '../constants/tracking';
import type {
  AccuracyQuality,
  GPSError,
  GPSPoint,
  PermissionState,
  TrackingConfig,
  TrackingSession,
  TrackingStatus,
  WatchOptions,
} from '../types/gps';
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
} from '../utils/session';
import { getAccuracyQuality } from '../utils/speed';

const ERRORS: Record<string, GPSError> = {
  unsupported: {
    kind: 'unsupported',
    message: 'Your browser does not support location services. Try a recent version of Chrome, Safari or Firefox.',
  },
  insecure: {
    kind: 'insecure-context',
    message: 'Location only works over HTTPS (or on localhost). Open this page using a secure https:// address.',
  },
  denied: {
    kind: 'permission-denied',
    message:
      'Location permission was denied. Allow location access for this site in your browser settings, then try again.',
  },
  unavailable: {
    kind: 'position-unavailable',
    message: 'Your position is currently unavailable. Make sure location services are on and move to an open area.',
  },
  timeout: {
    kind: 'timeout',
    message: 'Waiting for a GPS fix is taking longer than usual. Signal may be weak (indoors or obstructed).',
  },
  unknown: { kind: 'unknown', message: 'An unknown location error occurred.' },
};

function toGPSPoint(pos: GeolocationPosition): GPSPoint {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    speed: pos.coords.speed,
    timestamp: pos.timestamp,
  };
}

function toGPSError(err: GeolocationPositionError): GPSError {
  switch (err.code) {
    case 1:
      return ERRORS.denied!;
    case 2:
      return ERRORS.unavailable!;
    case 3:
      return ERRORS.timeout!;
    default:
      return ERRORS.unknown!;
  }
}

const isGeolocationSupported = (): boolean =>
  typeof navigator !== 'undefined' && 'geolocation' in navigator && !!navigator.geolocation;

/** Minimal subset of the Geolocation API the hook depends on. */
export type GeolocationProvider = Pick<Geolocation, 'watchPosition' | 'clearWatch' | 'getCurrentPosition'>;

export interface UseGPSTrackingOptions {
  config?: TrackingConfig;
  watchOptions?: WatchOptions;
  /** Override the location source (e.g. a simulator). Defaults to `navigator.geolocation`. */
  geolocation?: GeolocationProvider;
}

export interface GPSTracking {
  isTracking: boolean;
  /** All speeds in m/s. */
  currentSpeed: number;
  maxSpeed: number;
  averageSpeed: number;
  /** Meters. */
  distance: number;
  /** Total session wall-clock time, ms. */
  duration: number;
  /** Time spent above the stop threshold, ms. */
  movingTime: number;
  /** Latest accuracy radius in meters. */
  accuracy: number | null;
  accuracyQuality: AccuracyQuality;
  gpsStatus: TrackingStatus;
  error: GPSError | null;
  permission: PermissionState;
  isSupported: boolean;
  isSignalStale: boolean;
  hasData: boolean;
  session: TrackingSession;
  startTracking: () => void;
  stopTracking: () => void;
  resetTracking: () => void;
  requestPermission: () => void;
}

export function useGPSTracking(options: UseGPSTrackingOptions = {}): GPSTracking {
  const config = options.config ?? DEFAULT_TRACKING_CONFIG;
  const watchOptions = options.watchOptions ?? DEFAULT_WATCH_OPTIONS;
  const injected = options.geolocation;
  const isSupported = !!injected || isGeolocationSupported();

  const [session, setSession] = useState<TrackingSession>(createSession);
  const [timer, setTimer] = useState(createTimer);
  const [now, setNow] = useState(() => Date.now());
  const [isTracking, setIsTracking] = useState(false);
  const [status, setStatus] = useState<TrackingStatus>(isSupported ? 'ready' : 'unsupported');
  const [error, setError] = useState<GPSError | null>(isSupported ? null : ERRORS.unsupported!);
  const [permission, setPermission] = useState<PermissionState>('unknown');
  const [lastFixAt, setLastFixAt] = useState<number | null>(null);
  const [segmentStartedAt, setSegmentStartedAt] = useState<number | null>(null);

  const sessionRef = useRef(session);
  const watchIdRef = useRef<number | null>(null);
  const configRef = useRef(config);

  useEffect(() => {
    configRef.current = config;
  }, [config]);

  const commit = useCallback((next: TrackingSession) => {
    sessionRef.current = next;
    setSession(next);
  }, []);

  /** Returns the provider, or sets an error state and returns null. */
  const acquireProvider = useCallback((): GeolocationProvider | null => {
    if (injected) return injected;
    if (!isGeolocationSupported()) {
      setStatus('unsupported');
      setError(ERRORS.unsupported!);
      return null;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setStatus('error');
      setError(ERRORS.insecure!);
      return null;
    }
    return navigator.geolocation;
  }, [injected]);

  // Observe permission state where the Permissions API is available.
  useEffect(() => {
    if (injected) {
      setPermission('granted');
      return;
    }
    if (!isSupported || !navigator.permissions?.query) return;
    let cancelled = false;
    let permStatus: PermissionStatus | null = null;
    const onChange = () => permStatus && setPermission(permStatus.state as PermissionState);
    navigator.permissions
      .query({ name: 'geolocation' })
      .then((s) => {
        if (cancelled) return;
        permStatus = s;
        setPermission(s.state as PermissionState);
        s.addEventListener('change', onChange);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      permStatus?.removeEventListener('change', onChange);
    };
  }, [isSupported, injected]);

  const activeProviderRef = useRef<GeolocationProvider | null>(null);

  const clearWatch = useCallback(() => {
    if (watchIdRef.current !== null) {
      activeProviderRef.current?.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
      activeProviderRef.current = null;
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
    (pos: GeolocationPosition) => {
      const result = processPoint(sessionRef.current, toGPSPoint(pos), configRef.current);
      commit(result.session);
      setLastFixAt(Date.now());
      setPermission('granted');
      setError(null);
      setStatus(result.reason === 'low-accuracy' ? 'weak' : 'tracking');
    },
    [commit],
  );

  const handleError = useCallback(
    (err: GeolocationPositionError) => {
      setError(toGPSError(err));
      if (err.code === 1) {
        setPermission('denied');
        setStatus('error');
        halt();
      } else if (err.code === 3) {
        setStatus('weak'); // watcher keeps running and may recover
      } else {
        setStatus('error');
      }
    },
    [halt],
  );

  const startTracking = useCallback(() => {
    if (watchIdRef.current !== null) return;
    const geo = acquireProvider();
    if (!geo) return;

    const t = Date.now();
    commit(beginSegment(sessionRef.current));
    setError(null);
    setStatus('acquiring');
    setIsTracking(true);
    setLastFixAt(null);
    setSegmentStartedAt(t);
    setNow(t);
    setTimer((prev) => startTimer(prev, t));
    activeProviderRef.current = geo;
    watchIdRef.current = geo.watchPosition(handlePosition, handleError, watchOptions);
  }, [acquireProvider, commit, handlePosition, handleError, watchOptions]);

  const stopTracking = useCallback(() => {
    if (watchIdRef.current === null) return;
    halt();
    setStatus('ready');
    setError(null);
  }, [halt]);

  const resetTracking = useCallback(() => {
    const t = Date.now();
    const tracking = watchIdRef.current !== null;
    commit(createSession());
    setTimer(tracking ? startTimer(createTimer(), t) : createTimer());
    setNow(t);
  }, [commit]);

  const requestPermission = useCallback(() => {
    const geo = acquireProvider();
    if (!geo) return;
    geo.getCurrentPosition(
      (pos) => {
        setPermission('granted');
        setError(null);
        setStatus((s) => (s === 'error' || s === 'weak' ? 'ready' : s));
        commit({ ...sessionRef.current, lastAccuracy: pos.coords.accuracy });
      },
      (err) => {
        setError(toGPSError(err));
        if (err.code === 1) setPermission('denied');
        setStatus(err.code === 3 ? 'weak' : 'error');
      },
      watchOptions,
    );
  }, [acquireProvider, commit, watchOptions]);

  // Tick the clock while tracking so duration / staleness update.
  useEffect(() => {
    if (!isTracking) return;
    const id = window.setInterval(() => setNow(Date.now()), UI_TICK_MS);
    return () => window.clearInterval(id);
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
    isSupported,
    isSignalStale,
    hasData: session.acceptedPoints > 0 || timer.accumulatedMs > 0 || timer.runningSince !== null,
    session,
    startTracking,
    stopTracking,
    resetTracking,
    requestPermission,
  };
}
