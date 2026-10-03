import { useEffect, useMemo, useState } from 'react';
import { GPSStatus } from './components/GPSStatus';
import { PermissionPrompt } from './components/PermissionPrompt';
import { SpeedDisplay } from './components/SpeedDisplay';
import { StatsCard } from './components/StatsCard';
import { TrackingControls } from './components/TrackingControls';
import { UnitSelector } from './components/UnitSelector';
import { UNIT_LABELS } from './constants/tracking';
import { useGPSTracking } from './hooks/useGPSTracking';
import { useWakeLock } from './hooks/useWakeLock';
import type { AccuracyQuality, SpeedUnit } from './types/gps';
import { convertDistance, distanceUnitFor } from './utils/distance';
import { formatDistanceValue, formatDuration, formatNumber } from './utils/format';
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
            GPS speed is an estimate — its quality depends on signal accuracy.
            {gps.isTracking && wakeLockActive && ' Screen will stay on while tracking.'}
          </p>
        </footer>
      </main>
    </div>
  );
}
