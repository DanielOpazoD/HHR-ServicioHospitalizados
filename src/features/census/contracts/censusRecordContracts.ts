import type {
  DailyRecord as ApplicationDailyRecord,
  DailyRecordPatch as ApplicationDailyRecordPatch,
} from '@/application/shared/dailyRecordCoreContracts';

/**
 * Census code should depend on the application-facing daily record contract.
 *
 * This keeps census orchestration insulated from the persistence root shape and
 * lets the record evolve behind narrower contracts over time.
 */
export type DailyRecord = ApplicationDailyRecord;
export type DailyRecordPatch = ApplicationDailyRecordPatch;
