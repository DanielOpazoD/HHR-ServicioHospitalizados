/**
 * Narrow bridge for legacy daily record reads.
 *
 * Use this entrypoint from repositories that still need explicit legacy record
 * access while retirement remains in progress.
 */

export {
  discoverLegacyDataPath,
  getLegacyRecord,
  getLegacyRecordsRange,
  subscribeLegacyRecord,
} from '@/services/storage/legacyfirebase/legacyFirebaseRecordService';
