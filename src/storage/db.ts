/**
 * Minimal IndexedDB abstraction. Keeps the raw IDB API out of React
 * components and provides typed, promise-based access.
 *
 * Schema:
 *   Database: gps-speed-tracker
 *   Version: 1
 *
 *   Object stores:
 *     trips   – keyPath "id", index on "startedAt"
 *     drafts  – keyPath "id" (crash-recovery drafts)
 */

const DB_NAME = 'gps-speed-tracker';
const DB_VERSION = 1;

export const STORE_TRIPS = 'trips';
export const STORE_DRAFTS = 'drafts';

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_TRIPS)) {
        const trips = db.createObjectStore(STORE_TRIPS, { keyPath: 'id' });
        trips.createIndex('startedAt', 'startedAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) {
        db.createObjectStore(STORE_DRAFTS, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      dbPromise = null;
      reject(req.error);
    };
  });
  return dbPromise;
}

/** Typed read-write transaction helper. */
export async function withStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const db = await openDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeName, mode);
    const store = tx.objectStore(storeName);
    const req = fn(store);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Typed cursor-based iteration. */
export async function withCursor<T>(
  storeName: string,
  indexName: string | null,
  direction: IDBCursorDirection,
  fn: (cursor: IDBCursorWithValue) => T | undefined,
): Promise<T[]> {
  const db = await openDB();
  return new Promise<T[]>((resolve, reject) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const source = indexName ? store.index(indexName) : store;
    const req = source.openCursor(null, direction);
    const results: T[] = [];
    req.onsuccess = () => {
      const cursor = req.result;
      if (!cursor) {
        resolve(results);
        return;
      }
      const value = fn(cursor);
      if (value !== undefined) results.push(value);
      cursor.continue();
    };
    req.onerror = () => reject(req.error);
  });
}

/** Delete the entire database (development/testing). */
export function deleteDatabase(): Promise<void> {
  dbPromise = null;
  return new Promise((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}
