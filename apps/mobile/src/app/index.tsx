import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import * as Location from 'expo-location';
import { Link } from 'expo-router';
import { useNativeGPSTracking } from '../hooks/useNativeGPSTracking';
import { useNativeTripRecorder } from '../hooks/useNativeTripRecorder';
import { TrackingMap } from '../components/TrackingMap';


// Since formatDuration is missing from @gps/core, let's implement a simple formatter here for now
function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

export default function Index() {
  const [foregroundStatus, setForegroundStatus] = useState<Location.PermissionStatus | null>(null);
  const [autoFollow, setAutoFollow] = useState(true);

  const tracking = useNativeGPSTracking();
  const recorder = useNativeTripRecorder(
    tracking.isTracking,
    tracking.session,
    tracking.duration,
    tracking.trackPoints
  );

  useEffect(() => {
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      setForegroundStatus(status);
    })();
  }, []);

  const requestPermission = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    setForegroundStatus(status);
  };

  if (foregroundStatus === null) {
    return (
      <View style={styles.container}>
        <Text>Checking permissions...</Text>
      </View>
    );
  }

  if (foregroundStatus !== Location.PermissionStatus.GRANTED) {
    return (
      <View style={styles.container}>
        <Text style={styles.title}>GPS tracking needs your location</Text>
        <Text style={styles.description}>
          We use your location to calculate:
          {'\n'}• Current speed
          {'\n'}• Route
          {'\n'}• Distance
          {'\n'}• Trip statistics
          {'\n\n'}Your trip data is stored locally on your device.
        </Text>
        <TouchableOpacity style={styles.button} onPress={requestPermission}>
          <Text style={styles.buttonText}>CONTINUE</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const handleToggleTracking = () => {
    if (tracking.isTracking) {
      tracking.stopTracking();
    } else {
      tracking.resetTracking();
      tracking.startTracking();
      setAutoFollow(true);
    }
  };

  const handleRequestBackground = async () => {
    await Location.requestBackgroundPermissionsAsync();
    // Re-check foreground status just to re-render, though we might want a specific state for background
  };

  return (
    <View style={styles.dashboard}>
      <Text style={[styles.trackingStatus, !tracking.isTracking && { color: '#888' }]}>
        {tracking.isTracking ? 'TRACKING ●' : 'STOPPED'}
      </Text>
      
      <View style={styles.speedContainer}>
        <Text style={styles.speedValue}>{Math.round(tracking.currentSpeed * 3.6)}</Text>
        <Text style={styles.speedUnit}>km/h</Text>
      </View>

      <View style={styles.mapContainer}>
        <TrackingMap 
          points={tracking.trackPoints}
          currentPosition={tracking.trackPoints[tracking.trackPoints.length - 1] ?? null}
          isTracking={tracking.isTracking}
          autoFollow={autoFollow}
          onAutoFollowChange={setAutoFollow}
        />
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{(tracking.distance / 1000).toFixed(2)}</Text>
          <Text style={styles.statLabel}>DISTANCE (km)</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{(tracking.averageSpeed * 3.6).toFixed(1)}</Text>
          <Text style={styles.statLabel}>AVG SPEED</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{(tracking.maxSpeed * 3.6).toFixed(1)}</Text>
          <Text style={styles.statLabel}>MAX SPEED</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{formatTime(tracking.movingTime)}</Text>
          <Text style={styles.statLabel}>MOVING TIME</Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[styles.stopButton, tracking.isTracking ? { backgroundColor: '#ef2020' } : { backgroundColor: '#208AEF' }]} 
        onPress={handleToggleTracking}
      >
        <Text style={styles.buttonText}>
          {tracking.isTracking ? 'STOP TRACKING' : 'START TRACKING'}
        </Text>
      </TouchableOpacity>

      {!tracking.isTracking && (
        <TouchableOpacity style={styles.secondaryButton} onPress={handleRequestBackground}>
          <Text style={styles.secondaryButtonText}>Enable Background Tracking</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 24,
    justifyContent: 'center',
    backgroundColor: '#f8f9fa',
  },
  dashboard: {
    flex: 1,
    padding: 16,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    color: '#666',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#208AEF',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  stopButton: {
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
    marginTop: 16,
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  secondaryButton: {
    padding: 12,
    marginTop: 8,
    alignItems: 'center',
    width: '100%',
  },
  secondaryButtonText: {
    color: '#aaa',
    fontSize: 14,
    textDecorationLine: 'underline',
  },
  trackingStatus: {
    color: '#2ee6a0',
    fontWeight: 'bold',
    fontSize: 14,
    marginBottom: 16,
  },
  speedContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  speedValue: {
    fontSize: 72,
    fontWeight: 'bold',
    color: '#fff',
  },
  speedUnit: {
    fontSize: 20,
    color: '#888',
  },
  mapContainer: {
    width: '100%',
    flex: 1, // Let map take available vertical space
    backgroundColor: '#333',
    borderRadius: 12,
    marginBottom: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    width: '100%',
    justifyContent: 'space-between',
  },
  statBox: {
    width: '48%',
    backgroundColor: '#2a2a2a',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  statLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
  },
  link: {
    color: '#208AEF',
    fontSize: 16,
    fontWeight: 'bold',
  }
});
