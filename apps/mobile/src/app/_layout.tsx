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
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#208AEF' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: 'bold' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'GPS Tracker' }} />
        <Stack.Screen name="trips" options={{ title: 'Trip History' }} />
        <Stack.Screen name="settings" options={{ title: 'Settings' }} />
      </Stack>
    </>
  );
}
