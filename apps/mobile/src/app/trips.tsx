import React from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { getTrips, deleteTrip } from '../storage/db';
import type { TripMeta } from '@gps/core';
import { useFocusEffect, useRouter } from 'expo-router';

function formatTime(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function formatTripDate(ts: number): string {
  const d = new Date(ts);
  const day = d.getDate();
  const month = d.toLocaleString('en', { month: 'short' });
  const year = d.getFullYear();
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  return `${day} ${month} ${year} · ${time}`;
}

function groupByDate(trips: TripMeta[]): { label: string; trips: TripMeta[] }[] {
  const groups = new Map<string, { label: string; trips: TripMeta[] }>();
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const fmt = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const todayKey = fmt(today);
  const yesterdayKey = fmt(yesterday);

  for (const trip of trips) {
    const d = new Date(trip.startedAt);
    const key = fmt(d);
    let label: string;
    if (key === todayKey) label = 'Today';
    else if (key === yesterdayKey) label = 'Yesterday';
    else label = d.toLocaleDateString('en', { day: 'numeric', month: 'long', year: 'numeric' });

    if (!groups.has(label)) {
      groups.set(label, { label, trips: [] });
    }
    groups.get(label)!.trips.push(trip);
  }
  return [...groups.values()];
}

export default function TripsScreen() {
  const router = useRouter();
  const [trips, setTrips] = React.useState<TripMeta[]>([]);

  const loadTrips = () => {
    try {
      const data = getTrips();
      setTrips(data);
    } catch (e) {
      console.error("Failed to load trips", e);
    }
  };

  useFocusEffect(
    React.useCallback(() => {
      loadTrips();
    }, [])
  );

  const groups = groupByDate(trips);

  const renderTrip = (item: TripMeta) => (
    <TouchableOpacity
      key={item.id}
      style={styles.tripCard}
      activeOpacity={0.7}
      onPress={() => router.push(`/trip/${item.id}`)}
    >
      <View style={styles.tripHeader}>
        <Text style={styles.tripName}>{item.name}</Text>
        <Text style={styles.tripDate}>{formatTripDate(item.startedAt)}</Text>
      </View>
      <View style={styles.tripStats}>
        <View style={styles.tripStat}>
          <Text style={styles.statValue}>{(item.distanceMeters / 1000).toFixed(2)}</Text>
          <Text style={styles.statUnit}>km</Text>
        </View>
        <View style={styles.tripStat}>
          <Text style={styles.statValue}>{(item.averageSpeedMps * 3.6).toFixed(1)}</Text>
          <Text style={styles.statUnit}>km/h avg</Text>
        </View>
        <View style={styles.tripStat}>
          <Text style={styles.statValue}>{(item.maxSpeedMps * 3.6).toFixed(1)}</Text>
          <Text style={styles.statUnit}>km/h max</Text>
        </View>
        <View style={styles.tripStat}>
          <Text style={styles.statValue}>{formatTime(item.movingTimeMs)}</Text>
          <Text style={styles.statUnit}>time</Text>
        </View>
      </View>
      {item.elevationGainMeters !== null && (
        <View style={styles.elevationRow}>
          <Text style={styles.elevationText}>↑{item.elevationGainMeters} m</Text>
          {item.elevationLossMeters !== null && (
            <Text style={styles.elevationText}>↓{item.elevationLossMeters} m</Text>
          )}
        </View>
      )}
      <View style={styles.viewMore}>
        <Text style={styles.viewMoreText}>View Details →</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>TRIP HISTORY</Text>
        <Text style={styles.pageCount}>{trips.length} trip{trips.length !== 1 ? 's' : ''}</Text>
      </View>

      {trips.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>📍</Text>
          <Text style={styles.emptyText}>No trips recorded yet.</Text>
          <Text style={styles.emptySubText}>Start tracking to record your first trip.</Text>
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(item) => item.label}
          contentContainerStyle={styles.list}
          renderItem={({ item: group }) => (
            <View style={styles.group}>
              <Text style={styles.groupLabel}>{group.label}</Text>
              {group.trips.map(renderTrip)}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#2a2a2a',
  },
  pageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    letterSpacing: 1,
  },
  pageCount: {
    fontSize: 13,
    color: '#888',
  },
  list: {
    padding: 16,
    paddingBottom: 32,
  },
  group: {
    marginBottom: 20,
  },
  groupLabel: {
    fontSize: 13,
    color: '#208AEF',
    fontWeight: 'bold',
    marginBottom: 10,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 80,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    color: '#888',
  },
  tripCard: {
    backgroundColor: '#2a2a2a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
  },
  tripHeader: {
    marginBottom: 12,
  },
  tripName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  tripDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 3,
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  tripStat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  statUnit: {
    fontSize: 10,
    color: '#888',
    marginTop: 2,
  },
  elevationRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 4,
    marginBottom: 4,
  },
  elevationText: {
    fontSize: 12,
    color: '#2ee6a0',
    fontWeight: 'bold',
  },
  viewMore: {
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#3a3a3a',
    paddingTop: 10,
    alignItems: 'flex-end',
  },
  viewMoreText: {
    color: '#208AEF',
    fontSize: 13,
    fontWeight: 'bold',
  },
});
