import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntimeCore';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';

const canUseWindow = (): boolean => typeof window !== 'undefined';
const APP_STORAGE_PREFIXES = ['hhr_', 'hanga_roa_', 'indexeddb_'];
const APP_STORAGE_KEYS = new Set(['offlineQueue']);
const KNOWN_INDEXEDDB_DATABASES_TO_RESET = ['HangaRoaDB', 'firebaseLocalStorageDb'];
const INDEXEDDB_DELETE_TIMEOUT_MS = 1500;

interface ClearBrowserStorageOptions {
  preserveFirebaseAuth?: boolean;
  clearAll?: boolean;
}

const deleteIndexedDatabase = (databaseName: string): Promise<void> =>
  new Promise(resolve => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      resolve();
    };
    const timeout = window.setTimeout(() => {
      recordOperationalErrorTelemetry(
        'indexeddb',
        'indexeddb_delete_database_timeout',
        new Error(`IndexedDB delete timed out for ${databaseName}`),
        {
          code: 'indexeddb_delete_database_timeout',
          message: `La limpieza de la base local ${databaseName} no respondió a tiempo.`,
          severity: 'warning',
          userSafeMessage: 'La limpieza de una base local tardó demasiado.',
        }
      );
      finish();
    }, INDEXEDDB_DELETE_TIMEOUT_MS);
    const request = window.indexedDB.deleteDatabase(databaseName);

    request.onsuccess = () => finish();
    request.onerror = () => {
      recordOperationalErrorTelemetry(
        'indexeddb',
        'indexeddb_delete_database',
        request.error ?? new Error(`Failed to delete IndexedDB database ${databaseName}`),
        {
          code: 'indexeddb_delete_database_failed',
          message: `No fue posible limpiar la base local ${databaseName}.`,
          severity: 'warning',
          userSafeMessage: 'No fue posible limpiar una base local del navegador.',
        }
      );
      finish();
    };
    request.onblocked = () => {
      recordOperationalErrorTelemetry(
        'indexeddb',
        'indexeddb_delete_database_blocked',
        new Error(`IndexedDB delete blocked for ${databaseName}`),
        {
          code: 'indexeddb_delete_database_blocked',
          message: `La limpieza de la base local ${databaseName} fue bloqueada por una conexión abierta.`,
          severity: 'warning',
          userSafeMessage: 'La limpieza de una base local fue bloqueada por el navegador.',
        }
      );
      finish();
    };
  });

const clearIndexedDatabases = async (): Promise<void> => {
  if (!canUseWindow()) return;

  let databaseNames = KNOWN_INDEXEDDB_DATABASES_TO_RESET;

  try {
    const dbs =
      typeof window.indexedDB.databases === 'function' ? await window.indexedDB.databases() : [];
    const enumeratedDatabaseNames = dbs
      .map(dbInfo => dbInfo.name)
      .filter((name): name is string => Boolean(name));
    databaseNames = Array.from(
      new Set([...enumeratedDatabaseNames, ...KNOWN_INDEXEDDB_DATABASES_TO_RESET])
    );
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_clear_databases_enumeration', error, {
      code: 'indexeddb_clear_databases_enumeration_failed',
      message: 'No fue posible enumerar las bases locales IndexedDB; se limpiarán las conocidas.',
      severity: 'warning',
      userSafeMessage: 'No fue posible enumerar todas las bases locales del navegador.',
    });
  }

  try {
    await Promise.all(databaseNames.map(databaseName => deleteIndexedDatabase(databaseName)));
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_clear_databases', error, {
      code: 'indexeddb_clear_databases_failed',
      message: 'No fue posible limpiar las bases locales IndexedDB.',
      severity: 'warning',
      userSafeMessage: 'No fue posible limpiar las bases locales del navegador.',
    });
  }
};

const clearStorageBucket = (storage: Storage, options: ClearBrowserStorageOptions = {}): void => {
  if (options.clearAll) {
    storage.clear();
    return;
  }

  const keysToRemove: string[] = [];

  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index);
    if (!key) {
      continue;
    }

    if (
      options.preserveFirebaseAuth &&
      (key.startsWith('firebase:authUser:') || key.startsWith('firebase:redirectUser:'))
    ) {
      continue;
    }

    if (APP_STORAGE_KEYS.has(key) || APP_STORAGE_PREFIXES.some(prefix => key.startsWith(prefix))) {
      keysToRemove.push(key);
    }
  }

  for (const key of keysToRemove) {
    storage.removeItem(key);
  }
};

const clearBrowserStorage = (options: ClearBrowserStorageOptions = {}): void => {
  if (!canUseWindow()) return;

  clearStorageBucket(localStorage, options);
  clearStorageBucket(sessionStorage, options);
};

const unregisterServiceWorkers = async (): Promise<void> => {
  if (!canUseWindow() || !('serviceWorker' in navigator)) return;

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_unregister_service_workers', error, {
      code: 'indexeddb_unregister_service_workers_failed',
      message: 'No fue posible desregistrar service workers locales.',
      severity: 'warning',
      userSafeMessage: 'No fue posible limpiar service workers del navegador.',
    });
  }
};

const clearCacheStorage = async (): Promise<void> => {
  if (!canUseWindow() || !('caches' in window)) return;

  try {
    const cacheNames = await window.caches.keys();
    await Promise.all(cacheNames.map(cacheName => window.caches.delete(cacheName)));
  } catch (error) {
    recordOperationalErrorTelemetry('indexeddb', 'indexeddb_clear_cache_storage', error, {
      code: 'indexeddb_clear_cache_storage_failed',
      message: 'No fue posible limpiar caches locales del navegador.',
      severity: 'warning',
      userSafeMessage: 'No fue posible limpiar algunos caches locales del navegador.',
    });
  }
};

export const resetLocalDatabase = async (): Promise<void> => {
  await clearIndexedDatabases();
  clearBrowserStorage({ preserveFirebaseAuth: true });
  defaultBrowserWindowRuntime.reload();
};

export const performClientHardReset = async (): Promise<void> => {
  await unregisterServiceWorkers();
  await clearCacheStorage();
  clearBrowserStorage({ preserveFirebaseAuth: true });
  await clearIndexedDatabases();
  defaultBrowserWindowRuntime.reload();
};

export const resetLocalAppStorage = async (): Promise<void> => {
  await unregisterServiceWorkers();
  await clearCacheStorage();
  clearBrowserStorage({ clearAll: true });
  await clearIndexedDatabases();
  defaultBrowserWindowRuntime.reload();
};
