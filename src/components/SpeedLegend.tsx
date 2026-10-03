import { memo } from 'react';
import type { SpeedUnit } from '../types/gps';
import { getLegendItems } from '../utils/format';

export const SpeedLegend = memo(function SpeedLegend({ unit }: { unit: SpeedUnit }) {
  return (
    <div className="legend" id="speed-legend" aria-label="Route speed colours">
      <div className="legend__title">SPEED</div>
      <ul className="legend__list">
        {getLegendItems(unit).map((item) => (
          <li key={item.key} className="legend__item">
            <span className="legend__swatch" style={{ background: item.color }} aria-hidden="true" />
            {item.label}
          </li>
        ))}
      </ul>
    </div>
  );
});
