/**
 * Trip CRUD operations over IndexedDB.
 *
 * All functions are async and non-blocking. Components never call raw IDB.
 */
import type { Trip, TripDraft, TripMeta } from '../types/trip';
import { STORE_DRAFTS, STORE_TRIPS, withCursor, withStore } from './db';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Strip the heavy `points` array to get lightweight metadata. */
function toMeta(trip: Trip): TripMeta {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { points: _points, ...meta } = trip;
  return meta;
}

// ---------------------------------------------------------------------------
// Trips
// ---------------------------------------------------------------------------

/** Save a complete trip. Overwrites if the id already exists. */
export function saveTrip(trip: Trip): Promise<IDBValidKey> {
  return withStore(STORE_TRIPS, 'readwrite', (s) => s.put(trip));
}

/** Retrieve a trip with all its points. */
export function getTrip(id: string): Promise<Trip | undefined> {
  return withStore<Trip | undefined>(STORE_TRIPS, 'readonly', (s) => s.get(id) as IDBRequest<Trip | undefined>);
}

/** List trips newest-first, returning only metadata (no points). */
export function listTrips(): Promise<TripMeta[]> {
  return withCursor<TripMeta>(STORE_TRIPS, 'startedAt', 'prev', (cursor) => {
    const trip = cursor.value as Trip;
    return toMeta(trip);
  });
}

/** Update a trip's name. */
export async function updateTripName(id: string, name: string): Promise<void> {
  const trip = await getTrip(id);
  if (!trip) return;
  trip.name = name;
  await saveTrip(trip);
}

/** Delete a single trip. */
export function deleteTrip(id: string): Promise<void> {
  return withStore<undefined>(STORE_TRIPS, 'readwrite', (s) => s.delete(id) as IDBRequest<undefined>);
}

/** Delete all trips. */
export function clearAllTrips(): Promise<void> {
  return withStore<undefined>(STORE_TRIPS, 'readwrite', (s) => s.clear() as IDBRequest<undefined>);
}

/** Count stored trips. */
export function countTrips(): Promise<number> {
  return withStore<number>(STORE_TRIPS, 'readonly', (s) => s.count());
}

/** Estimate IndexedDB storage usage (bytes). Returns null if API unavailable. */
export async function estimateStorageUsage(): Promise<number | null> {
  if (!navigator.storage?.estimate) return null;
  const est = await navigator.storage.estimate();
  return est.usage ?? null;
}

// ---------------------------------------------------------------------------
// Drafts (crash recovery)
// ---------------------------------------------------------------------------

const DRAFT_KEY = 'active';

/** Persist a draft for crash recovery. */
export function saveDraft(draft: TripDraft): Promise<IDBValidKey> {
  return withStore(STORE_DRAFTS, 'readwrite', (s) => s.put({ ...draft, id: DRAFT_KEY }));
}

/** Retrieve the active draft (if any). */
export function getDraft(): Promise<TripDraft | undefined> {
  return withStore<TripDraft | undefined>(
    STORE_DRAFTS,
    'readonly',
    (s) => s.get(DRAFT_KEY) as IDBRequest<TripDraft | undefined>,
  );
}

/** Remove the active draft. */
export function deleteDraft(): Promise<void> {
  return withStore<undefined>(STORE_DRAFTS, 'readwrite', (s) => s.delete(DRAFT_KEY) as IDBRequest<undefined>);
}
