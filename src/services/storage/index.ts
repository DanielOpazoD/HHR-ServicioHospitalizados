// Storage compatibility barrel.
// Prefer direct module imports for new code. This file only exposes a curated stable surface.
// Retirement is tracked in `reports/compatibility-governance.md`.
export {
  deleteRecordFromFirestore,
  getAllRecordsFromFirestore,
  getAvailableDatesFromFirestore,
  getMonthRecordsFromFirestore,
  getRecordFromFirestore,
  moveRecordToTrash,
  saveRecordToFirestore,
  subscribeToRecord,
  updateRecordPartial,
  isFirestoreAvailable,
} from './firestore';
// Legacy facade kept for backwards compatibility.
export * as LocalStorage from './localStorageService';
// Preferred app-level local access facade.
export * as LocalPersistence from './unifiedLocalService';
// IndexedDB facade remains curated because many legacy call sites still depend on it.
export {
  clearAllRecords,
  clearAllSettings,
  createMockDatabase,
  deleteRecord,
  getAllDates,
  getAllRecords,
  getAllRecordsSorted,
  getAuditLogs,
  getAuditLogsForDate,
  getCatalog,
  getCatalogValues,
  getErrorLogs,
  getPreviousDayRecord,
  getRecordForDate,
  getRecordsForMonth,
  getRecordsRange,
  getSetting,
  hospitalDB,
  isDatabaseInFallbackMode,
  isIndexedDBAvailable,
  migrateFromLocalStorage,
  performClientHardReset,
  resetLocalAppStorage,
  resetLocalDatabase,
  saveAuditLog,
  saveCatalog,
  saveCatalogValues,
  saveErrorLog,
  saveRecord,
  saveRecords,
  saveSetting,
} from './indexedDBService';
