/**
 * Canonical local-record storage entrypoint.
 *
 * Use this module for direct record-store operations without depending on the
 * IndexedDB compatibility facade.
 */

export {
  clearAllRecords,
  deleteRecord,
  getAllDates,
  getAllRecords,
  getAllRecordsSorted,
  getPreviousDayRecord,
  getRecordForDate,
  getRecordsForMonth,
  getRecordsRange,
  saveRecord,
  saveRecords,
} from '@/services/storage/indexeddb/indexedDbRecordService';
