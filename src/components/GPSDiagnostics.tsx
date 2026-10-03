import { useState } from 'react';
import type { GPSTracking } from '../hooks/useGPSTracking';
import type { SpeedUnit } from '../types/gps';
import { formatSpeedWithUnit } from '../utils/format';

interface GPSDiagnosticsProps {
  gps: GPSTracking;
  unit: SpeedUnit;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function computeUpdateRate(points: { timestamp: number }[], maxSamples = 10): string {
  if (points.length < 2) return 'Calculating…';
  const recent = points.slice(-maxSamples);
  const duration = (recent[recent.length - 1]!.timestamp - recent[0]!.timestamp) / 1000;
  if (duration <= 0) return '0 Hz';
  const hz = (recent.length - 1) / duration;
  return `${hz.toFixed(1)} Hz`;
}

export function GPSDiagnostics({ gps, unit }: GPSDiagnosticsProps) {
  const [expanded, setExpanded] = useState(false);
  const current = gps.trackPoints[gps.trackPoints.length - 1];

  let headingText = 'Unavailable';
  if (current?.heading !== null && current?.heading !== undefined) {
    const h = ((current.heading % 360) + 360) % 360;
    headingText = `${Math.round(h)}° ${COMPASS[Math.round(h / 45) % 8]}`;
  }

  let altitudeText = 'Unavailable';
  if (current?.altitude !== null && current?.altitude !== undefined) {
    altitudeText = `${Math.round(current.altitude)} m`;
  }

  return (
    <section className={`diagnostics ${expanded ? 'diagnostics--expanded' : ''}`} aria-label="GPS Diagnostics">
      <button 
        type="button" 
        className="diagnostics__toggle" 
        onClick={() => setExpanded(e => !e)}
        aria-expanded={expanded}
      >
        <span className="diagnostics__title">GPS DIAGNOSTICS</span>
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <dl className="diagnostics__grid">
          <div className="diagnostics__item">
            <dt>GPS Accuracy</dt>
            <dd>{gps.accuracy !== null ? `±${Math.round(gps.accuracy)} m` : 'Unknown'}</dd>
          </div>
          <div className="diagnostics__item">
            <dt>Current Altitude</dt>
            <dd>{altitudeText}</dd>
          </div>
          <div className="diagnostics__item">
            <dt>Heading</dt>
            <dd>{headingText}</dd>
          </div>
          <div className="diagnostics__item">
            <dt>Current Speed</dt>
            <dd>{formatSpeedWithUnit(gps.currentSpeed, unit)}</dd>
          </div>
          <div className="diagnostics__item">
            <dt>Track Points</dt>
            <dd>{gps.trackPoints.length.toLocaleString()}</dd>
          </div>
          <div className="diagnostics__item">
            <dt>GPS Status</dt>
            <dd className="capitalize">{gps.gpsStatus}</dd>
          </div>
          <div className="diagnostics__item diagnostics__item--wide">
            <dt>Update Rate (Accepted)</dt>
            <dd>{computeUpdateRate(gps.trackPoints)}</dd>
          </div>
        </dl>
      )}
    </section>
  );
}
