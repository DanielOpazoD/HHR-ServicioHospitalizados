const LEGACY_READ_BLOCK_KEY = 'hhr_legacy_read_block_v1';
const LEGACY_READ_BLOCK_TTL_MS = 6 * 60 * 60 * 1000;
const LEGACY_MISSING_DATE_TTL_MS = 30 * 60 * 1000;
const LEGACY_MISSING_DATE_CACHE_KEY = 'hhr_legacy_missing_dates_v1';
const LEGACY_MISSING_DATE_CACHE_MAX = 120;
const LEGACY_DENIED_PATH_CACHE_KEY = 'hhr_legacy_denied_paths_v1';
const LEGACY_DENIED_PATH_TTL_MS = 6 * 60 * 60 * 1000;

let legacyReadBlockedForSession = false;
const legacyMissingDateCache = new Map<string, number>();
let legacyMissingDateCacheHydrated = false;
const legacyDeniedPathCache = new Map<string, number>();
let legacyDeniedPathCacheHydrated = false;

const readPersistedEntries = (storageKey: string): Array<[string, number]> => {
  if (typeof window === 'undefined' || !window.localStorage) return [];
  const raw = window.localStorage.getItem(storageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as Array<[string, number]>;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistEntries = (storageKey: string, entries: Array<[string, number]>): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(storageKey, JSON.stringify(entries));
};

const hydrateMissingDateCache = (): void => {
  if (legacyMissingDateCacheHydrated) return;
  legacyMissingDateCacheHydrated = true;

  for (const entry of readPersistedEntries(LEGACY_MISSING_DATE_CACHE_KEY)) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [date, ts] = entry;
    if (typeof date !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) continue;
    legacyMissingDateCache.set(date, ts);
  }
};

const hydrateDeniedPathCache = (): void => {
  if (legacyDeniedPathCacheHydrated) return;
  legacyDeniedPathCacheHydrated = true;

  for (const entry of readPersistedEntries(LEGACY_DENIED_PATH_CACHE_KEY)) {
    if (!Array.isArray(entry) || entry.length !== 2) continue;
    const [pathKey, ts] = entry;
    if (typeof pathKey !== 'string' || typeof ts !== 'number' || !Number.isFinite(ts)) continue;
    legacyDeniedPathCache.set(pathKey, ts);
  }
};

const persistMissingDateCache = (): void => {
  persistEntries(LEGACY_MISSING_DATE_CACHE_KEY, Array.from(legacyMissingDateCache.entries()));
};

const persistDeniedPathCache = (): void => {
  persistEntries(LEGACY_DENIED_PATH_CACHE_KEY, Array.from(legacyDeniedPathCache.entries()));
};

const readLegacyReadBlockTimestamp = (): number | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(LEGACY_READ_BLOCK_KEY);
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
};

const writeLegacyReadBlockTimestamp = (timestamp: number): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.setItem(LEGACY_READ_BLOCK_KEY, String(timestamp));
};

const removeLegacyReadBlockTimestamp = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(LEGACY_READ_BLOCK_KEY);
};

const normalizeLegacyPathKey = (path: string): string => {
  const parts = path.split('/');
  return parts.length <= 1 ? path : parts.slice(0, -1).join('/');
};

export const clearLegacyReadBlock = (): void => {
  legacyReadBlockedForSession = false;
  legacyDeniedPathCache.clear();
  persistDeniedPathCache();
  removeLegacyReadBlockTimestamp();
};

export const clearLegacyMissingDateCache = (): void => {
  hydrateMissingDateCache();
  legacyMissingDateCache.clear();
  if (typeof window !== 'undefined' && window.localStorage) {
    window.localStorage.removeItem(LEGACY_MISSING_DATE_CACHE_KEY);
  }
};

export const isLegacyPathDenied = (path: string): boolean => {
  hydrateDeniedPathCache();
  const pathKey = normalizeLegacyPathKey(path);
  const cachedAt = legacyDeniedPathCache.get(pathKey);
  if (!cachedAt) return false;
  if (Date.now() - cachedAt <= LEGACY_DENIED_PATH_TTL_MS) return true;
  legacyDeniedPathCache.delete(pathKey);
  persistDeniedPathCache();
  return false;
};

export const cacheLegacyDeniedPath = (path: string): void => {
  hydrateDeniedPathCache();
  legacyDeniedPathCache.set(normalizeLegacyPathKey(path), Date.now());
  persistDeniedPathCache();
};

export const isLegacyDateCachedMissing = (date: string): boolean => {
  hydrateMissingDateCache();
  const cachedAt = legacyMissingDateCache.get(date);
  if (!cachedAt) return false;
  if (Date.now() - cachedAt <= LEGACY_MISSING_DATE_TTL_MS) return true;
  legacyMissingDateCache.delete(date);
  persistMissingDateCache();
  return false;
};

export const cacheLegacyMissingDate = (date: string): void => {
  hydrateMissingDateCache();
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

  persistMissingDateCache();
};

export const clearLegacyMissingDate = (date: string): void => {
  hydrateMissingDateCache();
  legacyMissingDateCache.delete(date);
  persistMissingDateCache();
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
