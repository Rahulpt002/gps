import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getTrip, deleteTrip } from '../../storage/db';
import { TrackingMap } from '../../components/TrackingMap';
import type { Trip } from '@gps/core';

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const year = d.getFullYear();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} ${month} ${year} · ${time}`;
}

export default function TripDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);

  useEffect(() => {
    if (id) {
      try {
        const data = getTrip(id);
        setTrip(data);
      } catch (e) {
        console.error('Failed to load trip', e);
      }
    }
  }, [id]);

  // Replay timer
  useEffect(() => {
    if (!isReplaying || !trip) return;
    if (replayIndex >= trip.points.length - 1) {
      setIsReplaying(false);
      return;
    }
    const interval = setInterval(() => {
      setReplayIndex(prev => {
        if (prev >= trip.points.length - 1) {
          setIsReplaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 100); // 10x speed replay
    return () => clearInterval(interval);
  }, [isReplaying, trip, replayIndex]);

  const handleDelete = useCallback(() => {
    if (!id) return;
    Alert.alert('Delete Trip', 'Are you sure? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteTrip(id);
            router.back();
          } catch (e) {}
        },
      },
    ]);
  }, [id, router]);

  const handleReplay = () => {
    if (isReplaying) {
      setIsReplaying(false);
    } else {
      setReplayIndex(0);
      setIsReplaying(true);
    }
  };

  if (!trip) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading trip…</Text>
      </View>
    );
  }

  const replayPoints = isReplaying || replayIndex > 0
    ? trip.points.slice(0, replayIndex + 1)
    : trip.points;

  const currentReplayPoint = replayPoints[replayPoints.length - 1] ?? null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.tripName}>{trip.name}</Text>
        <Text style={styles.tripDate}>{formatDate(trip.startedAt)}</Text>
      </View>

      {/* Summary Stats */}
      <View style={styles.summaryGrid}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{(trip.distanceMeters / 1000).toFixed(2)}</Text>
          <Text style={styles.summaryLabel}>DISTANCE (km)</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{(trip.averageSpeedMps * 3.6).toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>AVG SPEED</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{(trip.maxSpeedMps * 3.6).toFixed(1)}</Text>
          <Text style={styles.summaryLabel}>MAX SPEED</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatTime(trip.movingTimeMs)}</Text>
          <Text style={styles.summaryLabel}>MOVING TIME</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{formatTime(trip.durationMs)}</Text>
          <Text style={styles.summaryLabel}>TOTAL TIME</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryValue}>{trip.pointCount}</Text>
          <Text style={styles.summaryLabel}>POINTS</Text>
        </View>
      </View>

      {/* Elevation stats */}
      {trip.elevationGainMeters !== null && (
        <View style={styles.elevationRow}>
          <Text style={styles.elevationText}>↑ {trip.elevationGainMeters} m</Text>
          {trip.elevationLossMeters !== null && (
            <Text style={styles.elevationText}>↓ {trip.elevationLossMeters} m</Text>
          )}
        </View>
      )}

      {/* Map */}
      <View style={styles.mapContainer}>
        <TrackingMap
          points={replayPoints}
          currentPosition={currentReplayPoint}
          isTracking={isReplaying}
          autoFollow={isReplaying}
          onAutoFollowChange={() => {}}
          fitRoute={!isReplaying && replayIndex === 0}
        />
      </View>

      {/* Replay progress */}
      {(isReplaying || replayIndex > 0) && (
        <View style={styles.replayProgress}>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                { width: `${((replayIndex + 1) / trip.points.length) * 100}%` },
              ]}
            />
          </View>
          <Text style={styles.replayText}>
            Point {replayIndex + 1} / {trip.points.length}
          </Text>
        </View>
      )}

      {/* Actions */}
      <View style={styles.actions}>
        <TouchableOpacity
          style={[styles.actionButton, styles.replayButton]}
          onPress={handleReplay}
        >
          <Text style={styles.actionButtonText}>
            {isReplaying ? '⏸ PAUSE REPLAY' : '▶ REPLAY TRIP'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.deleteButton]}
          onPress={handleDelete}
        >
          <Text style={[styles.actionButtonText, { color: '#ef4444' }]}>DELETE TRIP</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  content: {
    padding: 16,
    paddingBottom: 32,
  },
  loadingText: {
    color: '#888',
    textAlign: 'center',
    marginTop: 48,
    fontSize: 16,
  },
  header: {
    marginBottom: 16,
  },
  backButton: {
    marginBottom: 12,
  },
  backText: {
    color: '#208AEF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  tripName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripDate: {
    fontSize: 13,
    color: '#888',
    marginTop: 4,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  summaryItem: {
    width: '48%',
    backgroundColor: '#2a2a2a',
    padding: 14,
    borderRadius: 10,
    marginBottom: 10,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
  },
  summaryLabel: {
    fontSize: 11,
    color: '#888',
    marginTop: 4,
    letterSpacing: 0.5,
  },
  elevationRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginBottom: 12,
  },
  elevationText: {
    fontSize: 14,
    color: '#2ee6a0',
    fontWeight: 'bold',
  },
  mapContainer: {
    width: '100%',
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 12,
    backgroundColor: '#333',
  },
  replayProgress: {
    marginBottom: 12,
  },
  progressBar: {
    height: 4,
    backgroundColor: '#333',
    borderRadius: 2,
    marginBottom: 6,
  },
  progressFill: {
    height: 4,
    backgroundColor: '#208AEF',
    borderRadius: 2,
  },
  replayText: {
    color: '#888',
    fontSize: 12,
    textAlign: 'center',
  },
  actions: {
    gap: 10,
  },
  actionButton: {
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
  },
  replayButton: {
    backgroundColor: '#208AEF',
  },
  deleteButton: {
    backgroundColor: '#2a2a2a',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 15,
    letterSpacing: 0.5,
  },
});
