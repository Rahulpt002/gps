import React, { useEffect, useRef, useMemo, useState, useCallback } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { WebView } from 'react-native-webview';
import type { TrackPoint } from '@gps/core';
import { buildRouteSegments } from '@gps/core';

interface Props {
  points: TrackPoint[];
  currentPosition: TrackPoint | null;
  isTracking: boolean;
  autoFollow: boolean;
  onAutoFollowChange: (follow: boolean) => void;
  /** Zoom the map to show the whole route (used for trip details). */
  fitRoute?: boolean;
}

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { margin: 0; padding: 0; }
    html, body, #map { width: 100%; height: 100%; background: #1a1a1a; }
    .pulse { width: 22px; height: 22px; border-radius: 50%; background: rgba(32,138,239,0.25);
      display: flex; align-items: center; justify-content: center; animation: p 2s infinite; }
    .dot { width: 12px; height: 12px; border-radius: 50%; background: #208AEF; border: 2px solid #fff;
      box-shadow: 0 0 6px rgba(0,0,0,0.4); }
    @keyframes p { 0% { box-shadow: 0 0 0 0 rgba(32,138,239,0.5); } 70% { box-shadow: 0 0 0 14px rgba(32,138,239,0); } 100% { box-shadow: 0 0 0 0 rgba(32,138,239,0); } }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    var map = L.map('map', { zoomControl: false, attributionControl: false }).setView([20, 78], 4);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);

    var routeLayer = L.layerGroup().addTo(map);
    var marker = null, startMarker = null;
    var autoFollow = true, hasCentered = false, userDragging = false;

    window.setRoute = function(segments, fit) {
      routeLayer.clearLayers();
      var all = [];
      segments.forEach(function(s) {
        L.polyline(s.positions, { color: s.color, weight: 5, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }).addTo(routeLayer);
        all = all.concat(s.positions);
      });
      if (all.length) {
        L.circleMarker(all[0], { radius: 6, color: '#fff', weight: 2, fillColor: '#2ee6a0', fillOpacity: 1 }).addTo(routeLayer);
        if (fit) {
          L.circleMarker(all[all.length - 1], { radius: 6, color: '#fff', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(routeLayer);
          map.fitBounds(L.latLngBounds(all), { padding: [30, 30] });
          hasCentered = true;
        }
      }
    };

    window.setPosition = function(lat, lng) {
      if (!marker) {
        var icon = L.divIcon({ className: '', html: '<div class="pulse"><div class="dot"></div></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
        marker = L.marker([lat, lng], { icon: icon, zIndexOffset: 1000 }).addTo(map);
      } else {
        marker.setLatLng([lat, lng]);
      }
      if (autoFollow) {
        if (!hasCentered) { map.setView([lat, lng], 17); hasCentered = true; }
        else { map.panTo([lat, lng], { animate: true }); }
      }
    };

    window.setAutoFollow = function(v) {
      autoFollow = v;
      if (v && marker) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 16));
    };

    map.on('dragstart', function() {
      if (autoFollow) {
        autoFollow = false;
        window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'autoFollowOff' }));
      }
    });

    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'ready' }));
  </script>
</body>
</html>`;

export function TrackingMap({ points, currentPosition, isTracking, autoFollow, onAutoFollowChange, fitRoute = false }: Props) {
  const webViewRef = useRef<WebView>(null);
  const [ready, setReady] = useState(false);

  const segments = useMemo(
    () => buildRouteSegments(points, { simplifyToleranceMeters: 2 }).map(s => ({ positions: s.positions, color: s.color })),
    [points],
  );

  const run = useCallback((js: string) => {
    webViewRef.current?.injectJavaScript(`try { ${js} } catch (e) {} true;`);
  }, []);

  useEffect(() => {
    if (!ready) return;
    run(`window.setRoute(${JSON.stringify(segments)}, ${fitRoute ? 'true' : 'false'});`);
  }, [ready, segments, fitRoute, run]);

  useEffect(() => {
    if (!ready || !currentPosition) return;
    run(`window.setPosition(${currentPosition.latitude}, ${currentPosition.longitude});`);
  }, [ready, currentPosition?.latitude, currentPosition?.longitude, run]);

  useEffect(() => {
    if (!ready) return;
    run(`window.setAutoFollow(${autoFollow ? 'true' : 'false'});`);
  }, [ready, autoFollow, run]);

  const handleMessage = useCallback((event: any) => {
    try {
      const msg = JSON.parse(event.nativeEvent.data);
      if (msg.type === 'ready') setReady(true);
      else if (msg.type === 'autoFollowOff') onAutoFollowChange(false);
    } catch {}
  }, [onAutoFollowChange]);

  return (
    <View style={styles.container}>
      <WebView
        ref={webViewRef}
        source={{ html: MAP_HTML, baseUrl: 'https://localhost' }}
        originWhitelist={['*']}
        style={styles.map}
        javaScriptEnabled
        domStorageEnabled
        onMessage={handleMessage}
        onLoadStart={() => setReady(false)}
        scrollEnabled={false}
        bounces={false}
        overScrollMode="never"
        nestedScrollEnabled
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
      />

      {!autoFollow && currentPosition && (
        <TouchableOpacity style={styles.recenterButton} onPress={() => onAutoFollowChange(true)}>
          <Text style={styles.recenterText}>◎ RECENTER</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', borderRadius: 12, overflow: 'hidden' },
  map: { flex: 1, backgroundColor: '#1a1a1a' },
  recenterButton: {
    position: 'absolute', bottom: 16, right: 16, backgroundColor: '#1a1a1a',
    paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, elevation: 5,
  },
  recenterText: { color: '#fff', fontWeight: 'bold', fontSize: 12 },
});
