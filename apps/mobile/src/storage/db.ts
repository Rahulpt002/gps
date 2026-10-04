import * as SQLite from 'expo-sqlite';
import type { TrackPoint, Trip, TripMeta } from '@gps/core';
import * as Crypto from 'expo-crypto';

let db: SQLite.SQLiteDatabase | null = null;

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    db = SQLite.openDatabaseSync('gps_tracker.db');
  }
  return db;
}

export function initDB() {
  getDb().execSync(`
    CREATE TABLE IF NOT EXISTS trips (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      started_at INTEGER NOT NULL,
      ended_at INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      moving_time_ms INTEGER NOT NULL,
      distance_meters REAL NOT NULL,
      average_speed_mps REAL NOT NULL,
      max_speed_mps REAL NOT NULL,
      start_lat REAL NOT NULL,
      start_lng REAL NOT NULL,
      end_lat REAL NOT NULL,
      end_lng REAL NOT NULL,
      point_count INTEGER NOT NULL,
      elevation_gain_meters REAL,
      elevation_loss_meters REAL,
      highest_altitude_meters REAL,
      lowest_altitude_meters REAL,
      status TEXT DEFAULT 'completed'
    );

    CREATE TABLE IF NOT EXISTS track_points (
      id TEXT PRIMARY KEY,
      trip_id TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      latitude REAL NOT NULL,
      longitude REAL NOT NULL,
      speed_mps REAL NOT NULL,
      accuracy_meters REAL,
      altitude_meters REAL,
      heading_degrees REAL,
      segment INTEGER NOT NULL,
      FOREIGN KEY(trip_id) REFERENCES trips(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_track_points_trip_id ON track_points(trip_id);
    CREATE INDEX IF NOT EXISTS idx_track_points_timestamp ON track_points(timestamp);

    CREATE TABLE IF NOT EXISTS drafts (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL
    );
  `);
}

export function saveTrip(trip: Trip) {
  const database = getDb();
  const statement = database.prepareSync(`
    INSERT INTO trips (
      id, name, started_at, ended_at, duration_ms, moving_time_ms, 
      distance_meters, average_speed_mps, max_speed_mps, start_lat, start_lng, 
      end_lat, end_lng, point_count, elevation_gain_meters, elevation_loss_meters, 
      highest_altitude_meters, lowest_altitude_meters, status
    ) VALUES (
      ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'completed'
    )
  `);

  try {
    database.withTransactionSync(() => {
      statement.executeSync([
        trip.id, trip.name, trip.startedAt, trip.endedAt, trip.durationMs, trip.movingTimeMs,
        trip.distanceMeters, trip.averageSpeedMps, trip.maxSpeedMps, trip.startLat, trip.startLng,
        trip.endLat, trip.endLng, trip.pointCount, trip.elevationGainMeters, trip.elevationLossMeters,
        trip.highestAltitudeMeters, trip.lowestAltitudeMeters
      ]);

      const insertPoint = database.prepareSync(`
        INSERT INTO track_points (
          id, trip_id, timestamp, latitude, longitude, speed_mps, 
          accuracy_meters, altitude_meters, heading_degrees, segment
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
        )
      `);

      for (const point of trip.points) {
        insertPoint.executeSync([
          Crypto.randomUUID(), trip.id, point.timestamp, point.latitude, point.longitude, point.speed,
          point.accuracy ?? null, point.altitude ?? null, point.heading ?? null, point.segment
        ]);
      }
    });
  } finally {
    statement.finalizeSync();
  }
}

export function getTrips(): TripMeta[] {
  const database = getDb();
  const rows = database.getAllSync<{
    id: string; name: string; started_at: number; ended_at: number; duration_ms: number;
    moving_time_ms: number; distance_meters: number; average_speed_mps: number; max_speed_mps: number;
    start_lat: number; start_lng: number; end_lat: number; end_lng: number; point_count: number;
    elevation_gain_meters: number | null; elevation_loss_meters: number | null;
    highest_altitude_meters: number | null; lowest_altitude_meters: number | null;
  }>(`SELECT * FROM trips ORDER BY started_at DESC`);

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    durationMs: row.duration_ms,
    movingTimeMs: row.moving_time_ms,
    distanceMeters: row.distance_meters,
    averageSpeedMps: row.average_speed_mps,
    maxSpeedMps: row.max_speed_mps,
    startLat: row.start_lat,
    startLng: row.start_lng,
    endLat: row.end_lat,
    endLng: row.end_lng,
    pointCount: row.point_count,
    elevationGainMeters: row.elevation_gain_meters,
    elevationLossMeters: row.elevation_loss_meters,
    highestAltitudeMeters: row.highest_altitude_meters,
    lowestAltitudeMeters: row.lowest_altitude_meters,
  }));
}

export function getTrip(id: string): Trip | null {
  const database = getDb();
  const tripMeta = database.getFirstSync<{
    id: string; name: string; started_at: number; ended_at: number; duration_ms: number;
    moving_time_ms: number; distance_meters: number; average_speed_mps: number; max_speed_mps: number;
    start_lat: number; start_lng: number; end_lat: number; end_lng: number; point_count: number;
    elevation_gain_meters: number | null; elevation_loss_meters: number | null;
    highest_altitude_meters: number | null; lowest_altitude_meters: number | null;
  }>(`SELECT * FROM trips WHERE id = ?`, [id]);

  if (!tripMeta) return null;

  const pointsRows = database.getAllSync<{
    timestamp: number; latitude: number; longitude: number; speed_mps: number;
    accuracy_meters: number | null; altitude_meters: number | null; heading_degrees: number | null; segment: number;
  }>(`SELECT * FROM track_points WHERE trip_id = ? ORDER BY timestamp ASC`, [id]);

  const points: TrackPoint[] = pointsRows.map(p => ({
    timestamp: p.timestamp,
    latitude: p.latitude,
    longitude: p.longitude,
    speed: p.speed_mps,
    accuracy: p.accuracy_meters ?? null,
    altitude: p.altitude_meters ?? null,
    heading: p.heading_degrees ?? null,
    segment: p.segment,
  }));

  return {
    id: tripMeta.id,
    name: tripMeta.name,
    startedAt: tripMeta.started_at,
    endedAt: tripMeta.ended_at,
    durationMs: tripMeta.duration_ms,
    movingTimeMs: tripMeta.moving_time_ms,
    distanceMeters: tripMeta.distance_meters,
    averageSpeedMps: tripMeta.average_speed_mps,
    maxSpeedMps: tripMeta.max_speed_mps,
    startLat: tripMeta.start_lat,
    startLng: tripMeta.start_lng,
    endLat: tripMeta.end_lat,
    endLng: tripMeta.end_lng,
    pointCount: tripMeta.point_count,
    elevationGainMeters: tripMeta.elevation_gain_meters,
    elevationLossMeters: tripMeta.elevation_loss_meters,
    highestAltitudeMeters: tripMeta.highest_altitude_meters,
    lowestAltitudeMeters: tripMeta.lowest_altitude_meters,
    points,
  };
}

export function deleteTrip(id: string) {
  getDb().runSync(`DELETE FROM trips WHERE id = ?`, [id]);
}

export function saveDraft(draft: any) {
  getDb().runSync(`INSERT OR REPLACE INTO drafts (id, data) VALUES (?, ?)`, ['draft', JSON.stringify(draft)]);
}

export function getDraft(): any | null {
  const row = getDb().getFirstSync<{ data: string }>(`SELECT data FROM drafts WHERE id = 'draft'`);
  if (!row) return null;
  try {
    return JSON.parse(row.data);
  } catch (e) {
    return null;
  }
}

export function deleteDraft() {
  getDb().runSync(`DELETE FROM drafts WHERE id = 'draft'`);
}
