import type { CSSProperties } from 'react';
import { UNIT_LABELS } from '../constants/tracking';
import type { SpeedUnit } from '../types/gps';

const UNITS: SpeedUnit[] = ['kmh', 'mph', 'mps'];

interface UnitSelectorProps {
  unit: SpeedUnit;
  onChange: (unit: SpeedUnit) => void;
}

export function UnitSelector({ unit, onChange }: UnitSelectorProps) {
  return (
    <div className="units" role="radiogroup" aria-label="Speed unit">
      <span className="units__label">UNITS</span>
      <div className="units__group" style={{ '--index': UNITS.indexOf(unit) } as CSSProperties}>
        <span className="units__thumb" aria-hidden="true" />
        {UNITS.map((u) => (
          <button
            key={u}
            id={`unit-${u}`}
            type="button"
            role="radio"
            aria-checked={unit === u}
            className={`units__option ${unit === u ? 'units__option--active' : ''}`}
            onClick={() => onChange(u)}
          >
            {UNIT_LABELS[u]}
          </button>
        ))}
      </div>
    </div>
  );
}
