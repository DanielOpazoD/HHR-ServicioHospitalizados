/**
 * Canonical storage core entrypoint for app/runtime consumers.
 *
 * Use this module for fallback state, maintenance/reset and IndexedDB
 * availability/runtime primitives. Avoid importing `indexeddb/*` internals
 * directly from UI or hooks.
 */

export {
  getLocalPersistenceRuntimeSnapshot,
  HangaRoaDatabase,
  createMockDatabase,
  ensureDbReady,
  hospitalDB,
  isDatabaseInFallbackMode,
  isIndexedDBAvailable,
} from '@/services/storage/indexeddb/indexedDbCore';

export {
  performClientHardReset,
  resetLocalAppStorage,
  resetLocalDatabase,
} from '@/services/storage/indexeddb/indexedDbMaintenanceService';

export { migrateFromLocalStorage } from '@/services/storage/indexeddb/indexedDbMigrationService';
