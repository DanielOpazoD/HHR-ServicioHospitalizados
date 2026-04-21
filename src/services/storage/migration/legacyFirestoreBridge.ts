/**
 * Canonical legacy Firestore migration bridge.
 *
 * This is the only supported public entrypoint for legacy Firestore reads while
 * retirement is still in progress. New code must not import
 * `@/services/storage/legacyFirebaseService` directly.
 *
 * @deprecated Prefer the narrow bridges in this folder:
 * `legacyRecordReadBridge` for daily-record reads and
 * `legacyCatalogReadBridge` for catalog fallbacks.
 */

export * from '@/services/storage/migration/legacyRecordReadBridge';
export * from '@/services/storage/migration/legacyCatalogReadBridge';

export {
  getLegacyDb,
  initLegacyFirebase,
  isLegacyAvailable,
} from '@/services/storage/legacyfirebase/legacyFirebaseCore';
