import { useState, useEffect } from 'react';
import type { SpeedUnit, TrackPoint } from '@gps/core';
import { formatSpeedWithUnit } from '../utils/format';
import { Toast } from './Toast';

interface CurrentPositionPopupProps {
  point: TrackPoint;
  unit: SpeedUnit;
  onClose: () => void;
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function CurrentPositionPopup({ point, unit, onClose }: CurrentPositionPopupProps) {
  const [toast, setToast] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleCopy = async () => {
    const text = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;
    try {
      await navigator.clipboard.writeText(text);
      setToast('Coordinates copied!');
    } catch (err) {
      setToast('Failed to copy');
    }
  };

  let headingText = 'Unavailable';
  if (point.heading !== null) {
    const h = ((point.heading % 360) + 360) % 360;
    headingText = `${Math.round(h)}° ${COMPASS[Math.round(h / 45) % 8]}`;
  }

  let altitudeText = 'Unavailable';
  if (point.altitude !== null) {
    altitudeText = `${Math.round(point.altitude)} m`;
  }

  return (
    <>
      <div className="point-popup">
        <header className="point-popup__header">
          <span className="point-popup__title">CURRENT POSITION</span>
          <button type="button" className="point-popup__close" onClick={onClose} aria-label="Close">
            ×
          </button>
        </header>

        <dl className="point-popup__grid">
          <div className="point-popup__row">
            <dt>SPEED</dt>
            <dd>{formatSpeedWithUnit(point.speed, unit)}</dd>
          </div>
          <div className="point-popup__row">
            <dt>ACCURACY</dt>
            <dd>{point.accuracy !== null ? `±${Math.round(point.accuracy)} m` : 'Unknown'}</dd>
          </div>
          <div className="point-popup__row">
            <dt>ALTITUDE</dt>
            <dd>{altitudeText}</dd>
          </div>
          <div className="point-popup__row">
            <dt>HEADING</dt>
            <dd>{headingText}</dd>
          </div>
          <div className="point-popup__row point-popup__row--wide">
            <dt>COORDINATES</dt>
            <dd>{point.latitude.toFixed(6)}, {point.longitude.toFixed(6)}</dd>
          </div>
        </dl>
        
        <button type="button" className="btn btn--ghost btn--small" onClick={handleCopy} style={{ marginTop: 12, width: '100%' }}>
          COPY COORDINATES
        </button>
      </div>
      
      {toast && <Toast message={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}
