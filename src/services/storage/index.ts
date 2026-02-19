// Storage services barrel file
export * from './firestoreService';
// Legacy facade kept for backwards compatibility.
export * as LocalStorage from './localStorageService';
// Preferred app-level local access facade.
export * as LocalPersistence from './unifiedLocalService';
export * from './indexedDBService';
