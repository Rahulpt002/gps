import React, { useEffect, useRef, useMemo, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import MapView, { Marker, Polyline, PROVIDER_DEFAULT } from 'react-native-maps';
import type { TrackPoint } from '@gps/core';
import { buildRouteSegments } from '@gps/core';

interface Props {
  points: TrackPoint[];
  currentPosition: TrackPoint | null;
  isTracking: boolean;
  autoFollow: boolean;
  onAutoFollowChange: (follow: boolean) => void;
}

export function TrackingMap({ points, currentPosition, isTracking, autoFollow, onAutoFollowChange }: Props) {
  const mapRef = useRef<MapView>(null);
  const [hasCentered, setHasCentered] = useState(false);

  // Generate colored route segments for react-native-maps Polyline
  const segments = useMemo(() => {
    return buildRouteSegments(points, { simplifyToleranceMeters: 2 });
  }, [points]);

  // Handle follow mode
  useEffect(() => {
    if (autoFollow && currentPosition && mapRef.current) {
      const coord = {
        latitude: currentPosition.latitude,
        longitude: currentPosition.longitude,
      };
      
      if (!hasCentered) {
        mapRef.current.animateCamera({
          center: coord,
          zoom: 17,
        });
        setHasCentered(true);
      } else {
        mapRef.current.animateCamera({
          center: coord,
          // When heading is available and we're moving, we could set the heading here for navigation view.
          // heading: currentPosition.heading ?? undefined,
        });
      }
    }
  }, [currentPosition, autoFollow, hasCentered]);

  const handlePan = () => {
    if (autoFollow) {
      onAutoFollowChange(false);
    }
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        showsUserLocation={false} // We draw our own marker
        onPanDrag={handlePan}
      >
        {segments.map((s) => (
          <Polyline
            key={s.key}
            coordinates={s.positions.map(([latitude, longitude]) => ({ latitude, longitude }))}
            strokeColor={s.color}
            strokeWidth={5}
            lineCap="round"
            lineJoin="round"
          />
        ))}

        {currentPosition && (
          <Marker
            coordinate={{
              latitude: currentPosition.latitude,
              longitude: currentPosition.longitude,
            }}
            anchor={{ x: 0.5, y: 0.5 }}
            rotation={currentPosition.heading ?? 0}
            flat={true}
          >
            <View style={styles.currentMarker}>
              <View style={styles.currentMarkerInner} />
            </View>
          </Marker>
        )}
      </MapView>
      
      {!autoFollow && isTracking && currentPosition && (
        <TouchableOpacity 
          style={styles.recenterButton} 
          onPress={() => onAutoFollowChange(true)}
        >
          <Text style={styles.recenterText}>RECENTER</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
  },
  map: {
    ...StyleSheet.absoluteFill,
  },
  currentMarker: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(32, 138, 239, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentMarkerInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#208AEF',
    borderWidth: 2,
    borderColor: '#fff',
  },
  recenterButton: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: '#1a1a1a',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  recenterText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 12,
  },
});
