import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { getDraft, saveDraft } from '../storage/db';
import { processPoint, DEFAULT_TRACKING_CONFIG } from '@gps/core';
import type { GPSPoint, TripDraft } from '@gps/core';
import * as Crypto from 'expo-crypto';

export const BACKGROUND_LOCATION_TASK = 'BACKGROUND_LOCATION_TASK';

TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error) {
    console.error("Background Location Error", error);
    return;
  }
  
  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };
    if (!locations || locations.length === 0) return;

    try {
      const draft = getDraft();
      if (!draft) return; // No active trip

      let currentDraft: TripDraft = draft;
      let session = {
        distanceMeters: draft.distanceMeters,
        movingTimeMs: draft.movingTimeMs,
        maxSpeedMps: draft.maxSpeedMps,
        currentSpeedMps: 0,
        acceptedPoints: draft.points.length,
        lastAccuracy: null,
        trackPoints: draft.points,
        // Since we are in the background, we might not have the full session state.
        // For accurate distance/speed, the session logic in @gps/core ideally needs to run.
        // We will do a simplistic append for now, or rebuild the session object from points.
      };

      // To properly process points in the background, we rebuild the bare minimum session state
      // or we just trust the foreground to sync it later.
      // But the prompt wants background tracking to update distance and speed.
      // So we use the @gps/core processPoint function.
      let mockSession = {
        distanceMeters: currentDraft.distanceMeters,
        movingTimeMs: currentDraft.movingTimeMs,
        maxSpeedMps: currentDraft.maxSpeedMps,
        currentSpeedMps: 0,
        acceptedPoints: currentDraft.points.length,
        lastAccuracy: null,
        trackPoints: currentDraft.points,
      };

      for (const loc of locations) {
        const gpsPoint: GPSPoint = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          accuracy: loc.coords.accuracy ?? undefined,
          speed: loc.coords.speed,
          altitude: loc.coords.altitude ?? undefined,
          heading: loc.coords.heading ?? undefined,
          timestamp: loc.timestamp,
        };
        const result = processPoint(mockSession as any, gpsPoint, DEFAULT_TRACKING_CONFIG);
        mockSession = result.session as any;
      }

      currentDraft = {
        ...currentDraft,
        points: mockSession.trackPoints,
        distanceMeters: mockSession.distanceMeters,
        movingTimeMs: mockSession.movingTimeMs,
        maxSpeedMps: mockSession.maxSpeedMps,
        savedAt: Date.now(),
      };

      saveDraft(currentDraft);

    } catch (e) {
      console.error("Failed to process background location", e);
    }
  }
});
