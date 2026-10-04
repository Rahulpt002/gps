import type { SpeedUnit, TrackPoint } from '@gps/core';
import { describeTrackPoint } from '../utils/format';
import { getSpeedCategory } from '../utils/route';

interface TrackPointPopupProps {
  point: TrackPoint;
  index: number;
  total: number;
  unit: SpeedUnit;
  onClose: () => void;
}

/** Detail card for a tapped sample. Shows only measured values. */
export function TrackPointPopup({ point, index, total, unit, onClose }: TrackPointPopupProps) {
  const rows = describeTrackPoint(point, unit);
  const category = getSpeedCategory(point.speed);

  return (
    <div className="point-popup" id="track-point-popup" role="dialog" aria-label="GPS sample details">
      <div className="point-popup__header">
        <span className="point-popup__badge" style={{ background: category.color }} aria-hidden="true" />
        <span className="point-popup__title">
          SAMPLE {index + 1} / {total}
        </span>
        <button type="button" className="point-popup__close" onClick={onClose} aria-label="Close details" id="popup-close">
          ×
        </button>
      </div>
      <dl className="point-popup__grid">
        {rows.map((r) => (
          <div key={r.label} className={`point-popup__row ${r.label === 'COORDINATES' ? 'point-popup__row--wide' : ''}`}>
            <dt>{r.label}</dt>
            <dd className={r.value === 'Unavailable' ? 'muted' : undefined}>{r.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
