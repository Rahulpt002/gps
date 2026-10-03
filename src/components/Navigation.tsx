/**
 * Bottom navigation bar for mobile. Three tabs: Track, Trips, Settings.
 */
import type { AppRoute } from '../types/trip';

interface NavigationProps {
  route: AppRoute;
  onNavigate: (route: AppRoute) => void;
}

interface Tab {
  label: string;
  page: AppRoute['page'];
  route: AppRoute;
  icon: string; // SVG path
}

const TABS: Tab[] = [
  {
    label: 'Track',
    page: 'track',
    route: { page: 'track' },
    icon: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 010-5 2.5 2.5 0 010 5z',
  },
  {
    label: 'Trips',
    page: 'trips',
    route: { page: 'trips' },
    icon: 'M3 13h2v-2H3v2zm0 4h2v-2H3v2zm0-8h2V7H3v2zm4 4h14v-2H7v2zm0 4h14v-2H7v2zM7 7v2h14V7H7z',
  },
  {
    label: 'Settings',
    page: 'settings',
    route: { page: 'settings' },
    icon: 'M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.49.49 0 00-.59-.22l-2.39.96a7.04 7.04 0 00-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96a.49.49 0 00-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6A3.6 3.6 0 1115.6 12 3.61 3.61 0 0112 15.6z',
  },
];

function isActive(tab: Tab, route: AppRoute): boolean {
  if (tab.page === 'track') return route.page === 'track';
  if (tab.page === 'trips') return route.page === 'trips' || route.page === 'trip' || route.page === 'replay';
  return route.page === tab.page;
}

export function Navigation({ route, onNavigate }: NavigationProps) {
  return (
    <nav className="nav" aria-label="Main navigation">
      {TABS.map((tab) => {
        const active = isActive(tab, route);
        return (
          <button
            key={tab.page}
            type="button"
            className={`nav__tab ${active ? 'nav__tab--active' : ''}`}
            onClick={() => onNavigate(tab.route)}
            aria-current={active ? 'page' : undefined}
            aria-label={tab.label}
          >
            <svg className="nav__icon" viewBox="0 0 24 24" aria-hidden="true">
              <path d={tab.icon} fill="currentColor" />
            </svg>
            <span className="nav__label">{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}
