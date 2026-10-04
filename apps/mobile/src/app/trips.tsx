import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity } from 'react-native';
import { getTrips, deleteTrip } from '../storage/db';
import type { TripMeta } from '@gps/core';
import { useFocusEffect } from 'expo-router';

export default function TripsScreen() {
  const [trips, setTrips] = useState<TripMeta[]>([]);

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

  const handleDelete = (id: string) => {
    try {
      deleteTrip(id);
      loadTrips();
    } catch (e) {}
  };

  const renderTrip = ({ item }: { item: TripMeta }) => {
    const d = new Date(item.startedAt);
    return (
      <View style={styles.tripCard}>
        <View style={styles.tripHeader}>
          <Text style={styles.tripName}>{item.name}</Text>
          <Text style={styles.tripDate}>{d.toLocaleDateString()} {d.toLocaleTimeString()}</Text>
        </View>
        <View style={styles.tripStats}>
          <Text style={styles.stat}>Dist: {(item.distanceMeters / 1000).toFixed(2)} km</Text>
          <Text style={styles.stat}>Avg: {(item.averageSpeedMps * 3.6).toFixed(1)} km/h</Text>
          <Text style={styles.stat}>Max: {(item.maxSpeedMps * 3.6).toFixed(1)} km/h</Text>
        </View>
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          <Text style={styles.deleteText}>Delete</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {trips.length === 0 ? (
        <Text style={styles.emptyText}>No trips recorded yet.</Text>
      ) : (
        <FlatList
          data={trips}
          keyExtractor={(item) => item.id}
          renderItem={renderTrip}
          contentContainerStyle={styles.list}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
  list: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
    marginTop: 48,
    color: '#888',
    fontSize: 16,
  },
  tripCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tripHeader: {
    marginBottom: 8,
  },
  tripName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  tripDate: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  tripStats: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  stat: {
    fontSize: 14,
    color: '#555',
  },
  deleteButton: {
    alignSelf: 'flex-end',
  },
  deleteText: {
    color: '#ef2020',
    fontWeight: 'bold',
  },
});
