import type { ReactNode } from 'react';

interface StatsCardProps {
  id: string;
  label: string;
  value: string;
  unit?: string;
  footer?: ReactNode;
  variant?: 'default' | 'wide';
}

export function StatsCard({ id, label, value, unit, footer, variant = 'default' }: StatsCardProps) {
  return (
    <div className={`stat stat--${variant}`} id={id}>
      <div className="stat__label">{label}</div>
      <div className="stat__value">
        <span className="stat__number">{value}</span>
        {unit && <span className="stat__unit">{unit}</span>}
      </div>
      {footer && <div className="stat__footer">{footer}</div>}
    </div>
  );
}
