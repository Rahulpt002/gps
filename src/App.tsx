import { useCallback, useEffect, useMemo, useState } from 'react';
import { GPSStatus } from './components/GPSStatus';
import { PermissionPrompt } from './components/PermissionPrompt';
import { SpeedChart } from './components/SpeedChart';
import { SpeedDisplay } from './components/SpeedDisplay';
import { TrackingMap } from './components/TrackingMap';
import { StatsCard } from './components/StatsCard';
import { TrackingControls } from './components/TrackingControls';
import { MAP_RENDER_INTERVAL_MS, UNIT_LABELS } from './constants/tracking';
import { useGPSTracking } from './hooks/useGPSTracking';
import { useThrottledValue } from './hooks/useThrottledValue';
import { useWakeLock } from './hooks/useWakeLock';
import type { AccuracyQuality, SpeedUnit, TrackSelection } from './types/gps';
import { convertDistance, distanceUnitFor } from './utils/distance';
import { formatDistanceValue, formatDuration, formatNumber, formatSpeed } from './utils/format';
import { convertSpeed } from './utils/speed';
import { createSimulatedGeolocation } from './dev/simulatedGeolocation';
import { useTripRecorder } from './hooks/useTripRecorder';
import { useRouter } from './hooks/useRouter';
import { Navigation } from './components/Navigation';
import { TripHistoryPage } from './components/TripHistoryPage';
import { TripDetailsPage } from './components/TripDetailsPage';
import { TripReplayPage } from './components/TripReplayPage';
import { SettingsPage } from './components/SettingsPage';
import { GPSDiagnostics } from './components/GPSDiagnostics';
import { ConfirmDialog } from './components/ConfirmDialog';
import { Toast } from './components/Toast';
import { UNIT_STORAGE_KEY } from './constants/storage';

/** Dev-only: `?simulate` replaces real GPS with a simulated drive. */
const SIMULATE =
  import.meta.env.DEV && typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('simulate');

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
  const { route, navigate } = useRouter();
  const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

  const recorder = useTripRecorder(gps.isTracking, gps.session, gps.duration, gps.trackPoints);

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

  const renderTrackingView = () => {
    return (
      <>
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
        
        <GPSDiagnostics gps={gps} unit={unit} />

        {recorder.recovered && (
          <ConfirmDialog
            title="Unfinished trip recovered"
            message={`We found an unfinished trip from ${new Date(recorder.recovered.draft.startedAt).toLocaleString()}. Do you want to continue it?`}
            confirmLabel="Continue"
            cancelLabel="Discard"
            onConfirm={() => {
              // Engine recovery would go here, for now we just dismiss
              recorder.acceptRecovery();
            }}
            onCancel={recorder.discardRecovery}
          />
        )}
        
        {recorder.lastSaved && (
          <Toast 
            message="Trip saved successfully" 
            onDismiss={recorder.dismissSaved} 
          />
        )}


        <footer className="footer" style={{ marginTop: 24, paddingBottom: 80 }}>
          <p className="footer__note">
            {gps.isTracking && wakeLockActive && 'Screen will stay on while tracking.'}
          </p>
        </footer>
      </>
    );
  };

  return (
    <div className={`app app--${gps.gpsStatus}`}>
      <div className="app__glow" aria-hidden="true" />
      <main className={`shell ${route.page === 'track' ? 'shell--track' : (route.page === 'trip' || route.page === 'replay' ? 'shell--trip' : '')}`}>
        {route.page === 'track' && renderTrackingView()}
        {route.page === 'trips' && <TripHistoryPage unit={unit} onNavigate={navigate} refreshKey={historyRefreshKey} />}
        {route.page === 'trip' && <TripDetailsPage id={route.id} unit={unit} onNavigate={navigate} onDeleted={() => setHistoryRefreshKey(k => k + 1)} />}
        {route.page === 'replay' && <TripReplayPage id={route.id} unit={unit} onNavigate={navigate} />}
        {route.page === 'settings' && <SettingsPage unit={unit} onUnitChange={setUnit} onTripsCleared={() => setHistoryRefreshKey(k => k + 1)} />}
        
      </main>
      {(route.page === 'track' || route.page === 'trips' || route.page === 'settings') && (
        <Navigation route={route} onNavigate={navigate} />
      )}
    </div>
  );
}
