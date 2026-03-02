// Storage services barrel file.
// Prefer importing specific modules for new code; this barrel remains only for stable app-level access.
export * from './firestoreService';
// Legacy facade kept for backwards compatibility.
export * as LocalStorage from './localStorageService';
// Preferred app-level local access facade.
export * as LocalPersistence from './unifiedLocalService';
// IndexedDB facade remains curated because many legacy call sites still depend on it.
export * from './indexedDBService';
