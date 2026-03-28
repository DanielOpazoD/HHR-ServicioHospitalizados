import { createScopedLogger } from '@/services/utils/loggerScope';

export const uiSettingsLogger = createScopedLogger('UISettingsService');
export const tableConfigLogger = createScopedLogger('TableConfigService');
export const firestoreQueryLogger = createScopedLogger('FirestoreQueries');
export const firestoreWriteLogger = createScopedLogger('FirestoreWrites');
export const firestoreCatalogLogger = createScopedLogger('FirestoreCatalogService');
