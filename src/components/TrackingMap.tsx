/**
 * Live map of the current session. UI only: it renders ACCEPTED samples coming
 * from the tracking engine and never measures distance/speed itself.
 *
 * Performance notes:
 * - Canvas renderer (`preferCanvas`) for all vector layers.
 * - Route is drawn as a handful of merged same-colour runs; unchanged runs keep
 *   their object identity so Leaflet doesn't redraw them.
 * - Above ROUTE_SIMPLIFY_MIN_POINTS the drawn geometry is simplified; the
 *   original samples are untouched and still selectable.
 * - Per-sample dots only render when zoomed in, inside the viewport, capped.
 * - Parent passes throttled `points`, so this re-renders ~1×/s at most.
 */
import L from 'leaflet';
import { memo, useCallback, useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { Circle, CircleMarker, MapContainer, Marker, Polyline, TileLayer, useMapEvents } from 'react-leaflet';
import {
  MAP_DEFAULT_CENTER,
  MAP_DEFAULT_ZOOM,
  MAP_FOLLOW_ZOOM,
  MAP_MAX_POINT_DOTS,
  MAP_POINT_DOTS_MIN_ZOOM,
  MAP_POINT_HIT_RADIUS_PX,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  ROUTE_SIMPLIFY_MIN_POINTS,
  ROUTE_SIMPLIFY_TOLERANCE_METERS,
  UNIT_LABELS,
} from '../constants/tracking';
import type { SpeedUnit, TrackPoint, TrackSelection } from '../types/gps';
import { formatSpeed } from '../utils/format';
import {
  buildRouteSegments,
  findNearestPointIndex,
  getRouteMarkers,
  getSpeedCategory,
  getTrackBounds,
  stabilizeSegments,
  type RouteSegment,
} from '../utils/route';
import { MapControls } from './MapControls';
import { SpeedLegend } from './SpeedLegend';
import { TrackPointPopup } from './TrackPointPopup';
import { CurrentPositionPopup } from './CurrentPositionPopup';

export interface TrackingMapProps {
  points: TrackPoint[];
  currentPosition: TrackPoint | null;
  /** Pre-formatted live speed label for the current marker (e.g. "67 km/h"). */
  currentSpeedLabel: string | null;
  isTracking: boolean;
  unit: SpeedUnit;
  selection: TrackSelection | null;
  onSelect: (index: number | null, source: TrackSelection['source']) => void;
}

interface ViewState {
  bounds: L.LatLngBounds;
  zoom: number;
}

// Cache style objects so react-leaflet doesn't call setStyle on every render.
const styleCache = new Map<string, L.PathOptions>();
function style(key: string, make: () => L.PathOptions): L.PathOptions {
  let s = styleCache.get(key);
  if (!s) {
    s = make();
    styleCache.set(key, s);
  }
  return s;
}
const routeStyle = (color: string) =>
  style(`route:${color}`, () => ({ color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }));
const dotStyle = (color: string) =>
  style(`dot:${color}`, () => ({ color: '#05070b', weight: 1, fillColor: color, fillOpacity: 1 }));
const ACCURACY_STYLE: L.PathOptions = {
  color: '#3ab7ff',
  weight: 1,
  opacity: 0.6,
  fillColor: '#3ab7ff',
  fillOpacity: 0.08,
  dashArray: '4 4',
};

function pinIcon(variant: string, text: string): L.DivIcon {
  return L.divIcon({
    className: `route-pin route-pin--${variant}`,
    html: `<span class="route-pin__label">${text}</span>`,
    iconSize: [0, 0],
  });
}

function MapEvents(props: {
  programmaticRef: RefObject<boolean>;
  onUserMove: () => void;
  onViewChange: (v: ViewState) => void;
  onMapClick: (latlng: L.LatLng, map: L.Map) => void;
}) {
  const map = useMapEvents({
    dragstart: props.onUserMove,
    zoomstart: () => {
      if (!props.programmaticRef.current) props.onUserMove();
    },
    moveend: () => props.onViewChange({ bounds: map.getBounds(), zoom: map.getZoom() }),
    click: (e) => props.onMapClick(e.latlng, map),
  });
  return null;
}

export const TrackingMap = memo(function TrackingMap({
  points,
  currentPosition,
  currentSpeedLabel,
  isTracking,
  unit,
  selection,
  onSelect,
}: TrackingMapProps) {
  const [map, setMap] = useState<L.Map | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);
  const [view, setView] = useState<ViewState | null>(null);
  const [showCurrentPopup, setShowCurrentPopup] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const programmaticRef = useRef(false);
  const programmaticTimer = useRef<number | undefined>(undefined);
  const hasCenteredRef = useRef(false);
  const wasTrackingRef = useRef(isTracking);
  const pointsRef = useRef(points);
  const segmentsRef = useRef<RouteSegment[]>([]);

  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  /** Flag map movements we trigger so they aren't mistaken for user gestures. */
  const markProgrammatic = useCallback(() => {
    programmaticRef.current = true;
    window.clearTimeout(programmaticTimer.current);
    programmaticTimer.current = window.setTimeout(() => {
      programmaticRef.current = false;
    }, 900);
  }, []);

  // ---- Derived render data (memoised on the throttled point array) --------
  const segments = useMemo(() => {
    const tol = points.length > ROUTE_SIMPLIFY_MIN_POINTS ? ROUTE_SIMPLIFY_TOLERANCE_METERS : undefined;
    const next = stabilizeSegments(segmentsRef.current, buildRouteSegments(points, { simplifyToleranceMeters: tol }));
    segmentsRef.current = next;
    return next;
  }, [points]);

  const markers = useMemo(() => getRouteMarkers(points), [points]);

  const dotIndices = useMemo(() => {
    if (!view || view.zoom < MAP_POINT_DOTS_MIN_ZOOM) return [];
    const b = view.bounds.pad(0.1);
    const inView: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      if (b.contains([p.latitude, p.longitude])) inView.push(i);
    }
    if (inView.length <= MAP_MAX_POINT_DOTS) return inView;
    const stride = Math.ceil(inView.length / MAP_MAX_POINT_DOTS);
    return inView.filter((_, k) => k % stride === 0);
  }, [points, view]);

  // ---- Icons --------------------------------------------------------------
  const currentIcon = useMemo(
    () =>
      L.divIcon({
        className: 'cur-marker',
        html: `<span class="cur-marker__pulse"></span><span class="cur-marker__dot"></span>${
          currentSpeedLabel ? `<span class="cur-marker__label">${currentSpeedLabel}</span>` : ''
        }`,
        iconSize: [0, 0],
      }),
    [currentSpeedLabel],
  );
  const startIcon = useMemo(() => pinIcon('start', 'START'), []);
  const finishIcon = useMemo(() => pinIcon('finish', 'FINISH'), []);
  const maxSpeedText =
    markers.max !== null ? `MAX ${formatSpeed(points[markers.max]!.speed, unit, 0)} ${UNIT_LABELS[unit]}` : '';
  const maxIcon = useMemo(() => pinIcon('max', maxSpeedText), [maxSpeedText]);

  // ---- Camera behaviour ---------------------------------------------------
  const fitRoute = useCallback(() => {
    const bounds = getTrackBounds(pointsRef.current);
    if (!map || !bounds) return;
    setAutoFollow(false);
    markProgrammatic();
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: MAP_FOLLOW_ZOOM });
  }, [map, markProgrammatic]);

  const recenterTarget = currentPosition ?? points[points.length - 1] ?? null;
  const recenter = useCallback(() => {
    if (!map || !recenterTarget) return;
    setAutoFollow(true);
    markProgrammatic();
    map.setView([recenterTarget.latitude, recenterTarget.longitude], Math.max(map.getZoom(), 16));
  }, [map, recenterTarget, markProgrammatic]);

  // Tracking started → follow; tracking stopped → show the whole trip.
  useEffect(() => {
    if (isTracking && !wasTrackingRef.current) {
      setAutoFollow(true);
      hasCenteredRef.current = false;
    } else if (!isTracking && wasTrackingRef.current && pointsRef.current.length >= 2) {
      fitRoute();
    }
    wasTrackingRef.current = isTracking;
  }, [isTracking, fitRoute]);

  // Follow the current position while tracking, unless the user took over.
  useEffect(() => {
    if (!map || !currentPosition || !isTracking || !autoFollow) return;
    markProgrammatic();
    const ll: L.LatLngTuple = [currentPosition.latitude, currentPosition.longitude];
    if (!hasCenteredRef.current) {
      map.setView(ll, MAP_FOLLOW_ZOOM, { animate: false });
      hasCenteredRef.current = true;
    } else {
      map.panTo(ll, { animate: true, duration: 0.5 });
    }
  }, [map, currentPosition, isTracking, autoFollow, markProgrammatic]);

  // Keep Leaflet's size in sync with responsive layout changes.
  useEffect(() => {
    if (!map || !wrapperRef.current || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(wrapperRef.current);
    setView({ bounds: map.getBounds(), zoom: map.getZoom() });
    return () => ro.disconnect();
  }, [map]);

  useEffect(() => () => window.clearTimeout(programmaticTimer.current), []);

  // ---- Interaction --------------------------------------------------------
  const handleUserMove = useCallback(() => setAutoFollow(false), []);

  const handleMapClick = useCallback(
    (latlng: L.LatLng, m: L.Map) => {
      const p = m.latLngToContainerPoint(latlng);
      const edge = m.containerPointToLatLng([p.x + MAP_POINT_HIT_RADIUS_PX, p.y]);
      const maxMeters = latlng.distanceTo(edge);
      const idx = findNearestPointIndex(pointsRef.current, { latitude: latlng.lat, longitude: latlng.lng }, maxMeters);
      onSelect(idx, 'map');
    },
    [onSelect],
  );

  const selectAt = (index: number | null) => (index === null ? undefined : { click: () => onSelect(index, 'map') });

  const selected = selection && points[selection.index] ? points[selection.index]! : null;
  const showPopup = selection?.source === 'map' && selected !== null;

  // Clear current popup if a track point is selected
  useEffect(() => {
    if (showPopup) setShowCurrentPopup(false);
  }, [showPopup]);

  return (
    <div className="map" ref={wrapperRef}>
      <MapContainer
        ref={setMap}
        className="map__leaflet"
        center={MAP_DEFAULT_CENTER}
        zoom={MAP_DEFAULT_ZOOM}
        preferCanvas
        worldCopyJump
      >
        <TileLayer url={OSM_TILE_URL} attribution={OSM_ATTRIBUTION} maxZoom={19} />
        <MapEvents
          programmaticRef={programmaticRef}
          onUserMove={handleUserMove}
          onViewChange={setView}
          onMapClick={handleMapClick}
        />

        {segments.map((s) => (
          <Polyline key={s.key} positions={s.positions} pathOptions={routeStyle(s.color)} interactive={false} />
        ))}

        {dotIndices.map((i) => {
          const p = points[i]!;
          return (
            <CircleMarker
              key={i}
              center={[p.latitude, p.longitude]}
              radius={3}
              pathOptions={dotStyle(getSpeedCategory(p.speed).color)}
              interactive={false}
            />
          );
        })}

        {markers.start !== null && (
          <Marker
            position={[points[markers.start]!.latitude, points[markers.start]!.longitude]}
            icon={startIcon}
            eventHandlers={selectAt(markers.start)}
            zIndexOffset={500}
          />
        )}
        {!isTracking && markers.end !== null && points.length >= 2 && (
          <Marker
            position={[points[markers.end]!.latitude, points[markers.end]!.longitude]}
            icon={finishIcon}
            eventHandlers={selectAt(markers.end)}
            zIndexOffset={600}
          />
        )}
        {markers.max !== null && (
          <Marker
            position={[points[markers.max]!.latitude, points[markers.max]!.longitude]}
            icon={maxIcon}
            eventHandlers={selectAt(markers.max)}
            zIndexOffset={400}
          />
        )}

        {selected && (
          <CircleMarker
            center={[selected.latitude, selected.longitude]}
            radius={9}
            pathOptions={{ color: '#ffffff', weight: 3, fillColor: getSpeedCategory(selected.speed).color, fillOpacity: 1 }}
            interactive={false}
          />
        )}

        {isTracking && currentPosition && (
          <>
            {currentPosition.accuracy !== null && currentPosition.accuracy > 0 && (
              <Circle
                center={[currentPosition.latitude, currentPosition.longitude]}
                radius={currentPosition.accuracy}
                pathOptions={ACCURACY_STYLE}
                interactive={false}
              />
            )}
            <Marker
              position={[currentPosition.latitude, currentPosition.longitude]}
              icon={currentIcon}
              interactive={true}
              zIndexOffset={1000}
              eventHandlers={{ click: () => {
                setShowCurrentPopup(true);
                onSelect(null, 'map');
              }}}
            />
          </>
        )}
      </MapContainer>

      <MapControls
        showRecenter={recenterTarget !== null && (!autoFollow || !isTracking)}
        showFitRoute={points.length >= 2}
        onRecenter={recenter}
        onFitRoute={fitRoute}
      />

      {!showPopup && points.length > 0 && <SpeedLegend unit={unit} />}

      {points.length === 0 && (
        <div className="map__empty">
          {isTracking ? 'Waiting for an accurate GPS fix…' : 'Start tracking to draw your route'}
        </div>
      )}

      {showPopup && (
        <TrackPointPopup
          point={selected}
          index={selection.index}
          total={points.length}
          unit={unit}
          onClose={() => onSelect(null, 'map')}
        />
      )}

      {showCurrentPopup && currentPosition && (
        <CurrentPositionPopup
          point={currentPosition}
          unit={unit}
          onClose={() => setShowCurrentPopup(false)}
        />
      )}
    </div>
  );
});
