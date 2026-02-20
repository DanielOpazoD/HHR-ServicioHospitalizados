import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  where,
} from 'firebase/firestore';

import { parseDailyRecordWithDefaults } from '@/schemas/zodSchemas';
import { DailyRecord } from '@/types';

import { getLegacyDb } from './legacyFirebaseCore';
import {
  LEGACY_DISCOVERY_COLLECTION_PATHS,
  LEGACY_RECORD_COLLECTION_PATHS,
  LEGACY_RECORD_DOC_PATHS,
} from './legacyFirebasePaths';
import {
  isLegacyPermissionDeniedError,
  logLegacyError,
  logLegacyInfo,
} from './legacyFirebaseLogger';

let legacyReadBlockedForSession = false;
const LEGACY_READ_BLOCK_KEY = 'hhr_legacy_read_block_v1';
const LEGACY_READ_BLOCK_TTL_MS = 6 * 60 * 60 * 1000;
const LEGACY_MISSING_DATE_TTL_MS = 30 * 60 * 1000;
const LEGACY_MISSING_DATE_CACHE_KEY = 'hhr_legacy_missing_dates_v1';
const LEGACY_MISSING_DATE_CACHE_MAX = 120;
const legacyMissingDateCache = new Map<string, number>();
let legacyMissingDateCacheHydrated = false;
const LEGACY_DENIED_PATH_CACHE_KEY = 'hhr_legacy_denied_paths_v1';
const LEGACY_DENIED_PATH_TTL_MS = 6 * 60 * 60 * 1000;
const legacyDeniedPathCache = new Map<string, number>();
let legacyDeniedPathCacheHydrated = false;

const hydrateLegacyMissingDateCache = (): void => {
  if (legacyMissingDateCacheHydrated) return;
  legacyMissingDateCacheHydrated = true;

  if (typeof window === 'undefined' || !window.localStorage) return;
  const raw = window.localStorage.getItem(LEGACY_MISSING_DATE_CACHE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Array<[string, number]>;
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [date, ts] = entry;
      if (typeof date !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) continue;
      legacyMissingDateCache.set(date, ts);
    }
  } catch {
    // Ignore malformed persisted cache.
  }
};

const persistLegacyMissingDateCache = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const entries = Array.from(legacyMissingDateCache.entries());
  window.localStorage.setItem(LEGACY_MISSING_DATE_CACHE_KEY, JSON.stringify(entries));
};

const hydrateLegacyDeniedPathCache = (): void => {
  if (legacyDeniedPathCacheHydrated) return;
  legacyDeniedPathCacheHydrated = true;

  if (typeof window === 'undefined' || !window.localStorage) return;
  const raw = window.localStorage.getItem(LEGACY_DENIED_PATH_CACHE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as Array<[string, number]>;
    if (!Array.isArray(parsed)) return;
    for (const entry of parsed) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [pathKey, ts] = entry;
      if (typeof pathKey !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) continue;
      legacyDeniedPathCache.set(pathKey, ts);
    }
  } catch {
    // Ignore malformed persisted cache.
  }
};

const persistLegacyDeniedPathCache = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const entries = Array.from(legacyDeniedPathCache.entries());
  window.localStorage.setItem(LEGACY_DENIED_PATH_CACHE_KEY, JSON.stringify(entries));
};

const readLegacyReadBlockTimestamp = (): number | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(LEGACY_READ_BLOCK_KEY);
  if (!raw) return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
};

const writeLegacyReadBlockTimestamp = (timestamp: number): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(LEGACY_READ_BLOCK_KEY, String(timestamp));
};

const removeLegacyReadBlockTimestamp = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(LEGACY_READ_BLOCK_KEY);
};

export const clearLegacyReadBlock = (): void => {
  legacyReadBlockedForSession = false;
  legacyDeniedPathCache.clear();
  persistLegacyDeniedPathCache();
  removeLegacyReadBlockTimestamp();
};

export const clearLegacyMissingDateCache = (): void => {
  hydrateLegacyMissingDateCache();
  legacyMissingDateCache.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(LEGACY_MISSING_DATE_CACHE_KEY);
  }
};

const normalizeLegacyPathKey = (path: string): string => {
  const parts = path.split('/');
  if (parts.length <= 1) return path;
  return parts.slice(0, -1).join('/');
};

const isLegacyPathDenied = (path: string): boolean => {
  hydrateLegacyDeniedPathCache();
  const pathKey = normalizeLegacyPathKey(path);
  const cachedAt = legacyDeniedPathCache.get(pathKey);
  if (!cachedAt) return false;
  if (Date.now() - cachedAt <= LEGACY_DENIED_PATH_TTL_MS) return true;
  legacyDeniedPathCache.delete(pathKey);
  persistLegacyDeniedPathCache();
  return false;
};

const cacheLegacyDeniedPath = (path: string): void => {
  hydrateLegacyDeniedPathCache();
  legacyDeniedPathCache.set(normalizeLegacyPathKey(path), Date.now());
  persistLegacyDeniedPathCache();
};

const isLegacyDateCachedMissing = (date: string): boolean => {
  hydrateLegacyMissingDateCache();
  const cachedAt = legacyMissingDateCache.get(date);
  if (!cachedAt) return false;
  if (Date.now() - cachedAt <= LEGACY_MISSING_DATE_TTL_MS) return true;
  legacyMissingDateCache.delete(date);
  persistLegacyMissingDateCache();
  return false;
};

const cacheLegacyMissingDate = (date: string): void => {
  hydrateLegacyMissingDateCache();
  legacyMissingDateCache.set(date, Date.now());

  if (legacyMissingDateCache.size > LEGACY_MISSING_DATE_CACHE_MAX) {
    let oldestDate: string | null = null;
    let oldestTimestamp = Number.POSITIVE_INFINITY;
    for (const [cachedDate, ts] of legacyMissingDateCache.entries()) {
      if (ts < oldestTimestamp) {
        oldestTimestamp = ts;
        oldestDate = cachedDate;
      }
    }
    if (oldestDate) {
      legacyMissingDateCache.delete(oldestDate);
    }
  }

  persistLegacyMissingDateCache();
};

export const registerLegacyPermissionDeniedBlock = (): void => {
  legacyReadBlockedForSession = true;
  writeLegacyReadBlockTimestamp(Date.now());
};

export const isLegacyReadBlocked = (): boolean => {
  if (legacyReadBlockedForSession) return true;
  const timestamp = readLegacyReadBlockTimestamp();
  if (!timestamp) return false;
  if (Date.now() - timestamp <= LEGACY_READ_BLOCK_TTL_MS) {
    legacyReadBlockedForSession = true;
    return true;
  }
  removeLegacyReadBlockTimestamp();
  return false;
};

export const getLegacyRecord = async (date: string): Promise<DailyRecord | null> => {
  if (isLegacyReadBlocked() || isLegacyDateCachedMissing(date)) {
    return null;
  }

  const db = getLegacyDb();
  if (!db) {
    logLegacyInfo('[LegacyFirebase] No connection available');
    return null;
  }

  try {
    const possiblePaths = LEGACY_RECORD_DOC_PATHS(date);
    for (const path of possiblePaths) {
      if (isLegacyPathDenied(path)) {
        continue;
      }

      try {
        logLegacyInfo(`[LegacyFirebase] Testing path: ${path}`);
        const docRef = doc(db, path);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          logLegacyInfo(`[LegacyFirebase] Found record at: ${path}`);
          legacyMissingDateCache.delete(date);
          persistLegacyMissingDateCache();
          return parseDailyRecordWithDefaults(docSnap.data(), date);
        }
      } catch (error) {
        if (isLegacyPermissionDeniedError(error)) {
          cacheLegacyDeniedPath(path);
          registerLegacyPermissionDeniedBlock();
          return null;
        }
        logLegacyError(`[LegacyFirebase] Error testing path ${path}:`, error);
      }
    }

    logLegacyInfo(`[LegacyFirebase] No legacy record found for ${date}`);
    cacheLegacyMissingDate(date);
    return null;
  } catch (error) {
    logLegacyError('[LegacyFirebase] Error reading legacy record:', error);
    return null;
  }
};

export const getLegacyRecordsRange = async (
  startDate: string,
  endDate: string
): Promise<DailyRecord[]> => {
  if (isLegacyReadBlocked()) return [];

  const db = getLegacyDb();
  if (!db) return [];

  try {
    for (const collectionPath of LEGACY_RECORD_COLLECTION_PATHS) {
      try {
        const colRef = collection(db, collectionPath);
        const rangeQuery = query(
          colRef,
          where('date', '>=', startDate),
          where('date', '<=', endDate),
          orderBy('date', 'asc')
        );

        const snapshot = await getDocs(rangeQuery);
        if (!snapshot.empty) {
          logLegacyInfo(`[LegacyFirebase] Found ${snapshot.size} records in ${collectionPath}`);
          return snapshot.docs.map(d => parseDailyRecordWithDefaults(d.data(), d.id));
        }
      } catch {
        // Ignore invalid/non-existing path and continue with next option.
      }
    }
    return [];
  } catch (error) {
    logLegacyError('[LegacyFirebase] Error reading legacy range:', error);
    return [];
  }
};

export const subscribeLegacyRecord = (
  date: string,
  callback: (record: DailyRecord | null) => void
): (() => void) => {
  if (isLegacyReadBlocked()) {
    callback(null);
    return () => {};
  }

  const db = getLegacyDb();
  if (!db) {
    callback(null);
    return () => {};
  }

  const docRef = doc(db, 'hospitals/hanga_roa/dailyRecords', date);

  return onSnapshot(
    docRef,
    docSnap => {
      if (docSnap.exists()) {
        callback(parseDailyRecordWithDefaults(docSnap.data(), date));
      } else {
        callback(null);
      }
    },
    error => {
      logLegacyError('[LegacyFirebase] Subscription error:', error);
      callback(null);
    }
  );
};

export const discoverLegacyDataPath = async (): Promise<string | null> => {
  if (isLegacyReadBlocked()) return null;

  const db = getLegacyDb();
  if (!db) return null;

  for (const path of LEGACY_DISCOVERY_COLLECTION_PATHS) {
    try {
      const colRef = collection(db, path);
      const q = query(colRef, orderBy('date', 'desc'));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        logLegacyInfo(`[LegacyFirebase] Discovered data path: ${path} (${snapshot.size} records)`);
        return path;
      }
    } catch {
      // Path not found or unsupported query index.
    }
  }

  logLegacyInfo('[LegacyFirebase] Could not discover any valid data path');
  return null;
};
