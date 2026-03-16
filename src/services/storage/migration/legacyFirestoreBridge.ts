/**
 * Canonical legacy Firestore migration bridge.
 *
 * This is the only supported public entrypoint for legacy Firestore reads while
 * retirement is still in progress. New code must not import
 * `@/services/storage/legacyFirebaseService` directly.
 */

export {
  discoverLegacyDataPath,
  getLegacyRecord,
  getLegacyRecordsRange,
  subscribeLegacyRecord,
} from '@/services/storage/legacyfirebase/legacyFirebaseRecordService';

export {
  getLegacyNurseCatalog,
  getLegacyTensCatalog,
} from '@/services/storage/legacyfirebase/legacyFirebaseCatalogService';

export {
  getLegacyDb,
  initLegacyFirebase,
  isLegacyAvailable,
} from '@/services/storage/legacyfirebase/legacyFirebaseCore';
