/**
 * Legacy Firebase public facade.
 *
 * Keeps existing imports stable while delegating implementation
 * to focused modules.
 *
 * @deprecated Import from `@/services/storage/migration/legacyFirestoreBridge`
 * instead. This facade remains only as a compatibility bridge.
 */

export {
  initLegacyFirebase,
  getLegacyDb,
  isLegacyAvailable,
} from './legacyfirebase/legacyFirebaseCore';

export {
  getLegacyRecord,
  getLegacyRecordsRange,
  subscribeLegacyRecord,
  discoverLegacyDataPath,
} from './legacyfirebase/legacyFirebaseRecordService';

export {
  getLegacyNurseCatalog,
  getLegacyTensCatalog,
} from './legacyfirebase/legacyFirebaseCatalogService';
