/**
 * Minimal hash-based router. No external dependencies.
 *
 * Routes:
 *   #/          → track
 *   #/track     → track
 *   #/trips     → trips
 *   #/trips/:id → trip details
 *   #/trips/:id/replay → trip replay
 *   #/settings  → settings
 */
import { useCallback, useEffect, useState } from 'react';
import type { AppRoute } from '../types/trip';

function parseHash(hash: string): AppRoute {
  const h = hash.replace(/^#\/?/, '');
  if (!h || h === 'track') return { page: 'track' };
  if (h === 'trips') return { page: 'trips' };
  if (h === 'settings') return { page: 'settings' };

  const tripMatch = /^trips\/([^/]+)$/.exec(h);
  if (tripMatch) return { page: 'trip', id: tripMatch[1]! };

  const replayMatch = /^trips\/([^/]+)\/replay$/.exec(h);
  if (replayMatch) return { page: 'replay', id: replayMatch[1]! };

  return { page: 'track' };
}

function routeToHash(route: AppRoute): string {
  switch (route.page) {
    case 'track': return '#/track';
    case 'trips': return '#/trips';
    case 'trip': return `#/trips/${route.id}`;
    case 'replay': return `#/trips/${route.id}/replay`;
    case 'settings': return '#/settings';
  }
}

export interface Router {
  route: AppRoute;
  navigate: (route: AppRoute) => void;
  back: () => void;
}

export function useRouter(): Router {
  const [route, setRoute] = useState<AppRoute>(() => parseHash(location.hash));

  useEffect(() => {
    const onHashChange = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  const navigate = useCallback((r: AppRoute) => {
    location.hash = routeToHash(r);
  }, []);

  const back = useCallback(() => {
    history.back();
  }, []);

  return { route, navigate, back };
}
