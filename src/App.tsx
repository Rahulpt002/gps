import { useCallback, useEffect, useMemo, useState } from 'react';
import { GPSStatus } from './components/GPSStatus';
import { PermissionPrompt } from './components/PermissionPrompt';
import { SpeedChart } from './components/SpeedChart';
import { SpeedDisplay } from './components/SpeedDisplay';
import { TrackingMap } from './components/TrackingMap';
import { TripSummary } from './components/TripSummary';
import { StatsCard } from './components/StatsCard';
import { TrackingControls } from './components/TrackingControls';
import { UnitSelector } from './components/UnitSelector';
import { MAP_RENDER_INTERVAL_MS, UNIT_LABELS } from './constants/tracking';
import { useGPSTracking } from './hooks/useGPSTracking';
import { useThrottledValue } from './hooks/useThrottledValue';
import { useWakeLock } from './hooks/useWakeLock';
import type { AccuracyQuality, SpeedUnit, TrackSelection } from './types/gps';
import { convertDistance, distanceUnitFor } from './utils/distance';
import { formatDistanceValue, formatDuration, formatNumber, formatSpeed } from './utils/format';
import { convertSpeed } from './utils/speed';
import { createSimulatedGeolocation } from './dev/simulatedGeolocation';

/** Dev-only: `?simulate` replaces real GPS with a simulated drive. */
const SIMULATE =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('simulate');

const UNIT_STORAGE_KEY = 'gps-speed-tracker:unit';

const QUALITY_LABELS: Record<AccuracyQuality, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  unknown: 'No fix',
};

function loadUnit(): SpeedUnit {
  try {
    const saved = localStorage.getItem(UNIT_STORAGE_KEY);
    if (saved === 'kmh' || saved === 'mph' || saved === 'mps') return saved;
  } catch {
    /* storage unavailable */
  }
  return 'kmh';
}

export default function App() {
  const simulator = useMemo(() => (SIMULATE ? createSimulatedGeolocation() : undefined), []);
  const gps = useGPSTracking({ geolocation: simulator });
  const [unit, setUnit] = useState<SpeedUnit>(loadUnit);
  const wakeLockActive = useWakeLock(gps.isTracking);

  // Map/chart render from a throttled view of the engine's accepted samples.
  // The engine still processes every GPS fix; only visuals are rate-limited.
  const trackPoints = useThrottledValue(gps.trackPoints, MAP_RENDER_INTERVAL_MS, !gps.isTracking);
  const currentPosition = gps.isTracking ? (trackPoints[trackPoints.length - 1] ?? null) : null;
  const currentSpeedLabel =
    gps.isTracking && !gps.isSignalStale ? `${formatSpeed(gps.currentSpeed, unit, 0)} ${UNIT_LABELS[unit]}` : null;

  const [rawSelection, setSelection] = useState<TrackSelection | null>(null);
  const selection = rawSelection && rawSelection.index < trackPoints.length ? rawSelection : null;
  const handleSelect = useCallback((index: number | null, source: TrackSelection['source']) => {
    setSelection((prev) => {
      if (index !== null) return { index, source };
      // Clearing from the chart (mouse leave) must not close a map popup.
      return prev && prev.source !== source ? prev : null;
    });
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(UNIT_STORAGE_KEY, unit);
    } catch {
      /* ignore */
    }
  }, [unit]);

  const unitLabel = UNIT_LABELS[unit];
  const speedValue = (mps: number) => formatNumber(convertSpeed(mps, unit), 1);
  const accuracyText = gps.accuracy != null ? `±${Math.round(gps.accuracy)}` : '--';

  return (
    <div className={`app app--${gps.gpsStatus}`}>
      <div className="app__glow" aria-hidden="true" />
      <main className="shell">
        <header className="header">
          <h1 className="header__title">
            GPS <span>SPEED</span> TRACKER
          </h1>
          <GPSStatus status={gps.gpsStatus} />
          {SIMULATE && (
            <span className="sim-badge" id="simulation-badge">
              SIMULATED GPS — DEV MODE
            </span>
          )}
        </header>

        <PermissionPrompt
          permission={gps.permission}
          status={gps.gpsStatus}
          error={gps.error}
          isTracking={gps.isTracking}
          onEnable={gps.requestPermission}
        />

        <SpeedDisplay
          speedMps={gps.currentSpeed}
          maxSpeedMps={gps.maxSpeed}
          unit={unit}
          active={gps.isTracking}
          stale={gps.isSignalStale}
        />

        <section className="map-panel" aria-label="Route map and speed timeline">
          <TrackingMap
            points={trackPoints}
            currentPosition={currentPosition}
            currentSpeedLabel={currentSpeedLabel}
            isTracking={gps.isTracking}
            unit={unit}
            selection={selection}
            onSelect={handleSelect}
          />
          <SpeedChart points={trackPoints} unit={unit} selection={selection} onSelect={handleSelect} />
        </section>

        <section className="stats" aria-label="Session statistics">
          <StatsCard id="stat-max" label="MAX" value={speedValue(gps.maxSpeed)} unit={unitLabel} />
          <StatsCard id="stat-avg" label="AVG" value={speedValue(gps.averageSpeed)} unit={unitLabel} />
          <StatsCard
            id="stat-distance"
            label="DIST"
            value={formatDistanceValue(convertDistance(gps.distance, unit))}
            unit={distanceUnitFor(unit)}
          />
          <StatsCard
            id="stat-time"
            label="TIME"
            value={formatDuration(gps.duration)}
            variant="wide"
            footer={<span className="muted">Moving {formatDuration(gps.movingTime)}</span>}
          />
          <StatsCard
            id="stat-accuracy"
            label="GPS ACCURACY"
            value={accuracyText}
            unit={gps.accuracy != null ? 'm' : undefined}
            variant="wide"
            footer={
              <span className={`quality quality--${gps.accuracyQuality}`}>
                <span className="quality__dot" aria-hidden="true" />
                {QUALITY_LABELS[gps.accuracyQuality]}
              </span>
            }
          />
        </section>

        <TrackingControls
          isTracking={gps.isTracking}
          hasData={gps.hasData}
          disabled={!gps.isSupported}
          onStart={gps.startTracking}
          onStop={gps.stopTracking}
          onReset={gps.resetTracking}
        />

        {!gps.isTracking && gps.trackPoints.length > 0 && (
          <TripSummary
            distanceMeters={gps.distance}
            movingTimeMs={gps.movingTime}
            totalTimeMs={gps.duration}
            averageSpeedMps={gps.averageSpeed}
            maxSpeedMps={gps.maxSpeed}
            pointCount={gps.trackPoints.length}
            unit={unit}
          />
        )}

        <UnitSelector unit={unit} onChange={setUnit} />

        <footer className="footer">
          <p className="footer__privacy">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2 4 5v6c0 5 3.4 9.7 8 11 4.6-1.3 8-6 8-11V5l-8-3Zm-1 14.5-3.5-3.5 1.4-1.4 2.1 2.1 4.6-4.6 1.4 1.4-6 6Z"
                fill="currentColor"
              />
            </svg>
            Your location data stays on this device.
          </p>
          <p className="footer__note">
            GPS speed is an estimate — its quality depends on signal accuracy. Route colours are visual speed bands, not
            speed limits. Map tiles load from OpenStreetMap; your coordinates are never uploaded.
            {gps.isTracking && wakeLockActive && ' Screen will stay on while tracking.'}
          </p>
        </footer>
      </main>
    </div>
  );
}
