import { createScopedLoggerMap } from '@/services/utils/loggerScope';

export const {
  uiSettingsLogger,
  tableConfigLogger,
  firestoreQueryLogger,
  firestoreWriteLogger,
  firestoreCatalogLogger,
} = createScopedLoggerMap({
  uiSettingsLogger: 'UISettingsService',
  tableConfigLogger: 'TableConfigService',
  firestoreQueryLogger: 'FirestoreQueries',
  firestoreWriteLogger: 'FirestoreWrites',
  firestoreCatalogLogger: 'FirestoreCatalogService',
});
