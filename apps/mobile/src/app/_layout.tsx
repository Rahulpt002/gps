import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import * as Location from 'expo-location';
import { initDB } from '../storage/db';
import '../tasks/backgroundLocation';

export default function RootLayout() {
  useEffect(() => {
    try {
      initDB();
    } catch (e) {
      console.error("Failed to init DB", e);
    }
  }, []);
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#111' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
          contentStyle: { backgroundColor: '#1a1a1a' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'GPS Tracker' }} />
        <Stack.Screen name="trips" options={{ title: 'Trip History' }} />
        <Stack.Screen name="trip/[id]" options={{ title: 'Trip Details' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
