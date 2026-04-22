import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';

const canUseWindow = (): boolean => typeof window !== 'undefined';
const APP_STORAGE_PREFIXES = ['hhr_', 'hanga_roa_', 'indexeddb_'];
const APP_STORAGE_KEYS = new Set(['offlineQueue']);

interface ClearBrowserStorageOptions {
  preserveFirebaseAuth?: boolean;
  clearAll?: boolean;
}

const clearIndexedDatabases = async (): Promise<void> => {
  if (!canUseWindow()) return;

  try {
    const dbs = await window.indexedDB.databases();
    for (const dbInfo of dbs) {
      if (dbInfo.name) {
        window.indexedDB.deleteDatabase(dbInfo.name);
      }
    }
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

export const resetLocalDatabase = async (): Promise<void> => {
  await clearIndexedDatabases();
  clearBrowserStorage({ preserveFirebaseAuth: true });
  defaultBrowserWindowRuntime.reload();
};

export const performClientHardReset = async (): Promise<void> => {
  await unregisterServiceWorkers();
  await clearIndexedDatabases();
  clearBrowserStorage({ preserveFirebaseAuth: true });
  defaultBrowserWindowRuntime.reload();
};

export const resetLocalAppStorage = async (): Promise<void> => {
  await unregisterServiceWorkers();
  await clearIndexedDatabases();
  clearBrowserStorage({ clearAll: true });
  defaultBrowserWindowRuntime.reload();
};
