import type {
  DailyRecordBedAuditState as RootDailyRecordBedAuditState,
  DailyRecordBedLayoutState as RootDailyRecordBedLayoutState,
  DailyRecordBedsState as RootDailyRecordBedsState,
  DailyRecordCriticalValidationState as RootDailyRecordCriticalValidationState,
} from '@/types/domain/dailyRecordSlices';

/**
 * Bed/inventory-facing slices of the daily record contract.
 */
export type DailyRecordBedsState = RootDailyRecordBedsState;
export type DailyRecordBedAuditState = RootDailyRecordBedAuditState;
export type DailyRecordBedLayoutState = RootDailyRecordBedLayoutState;
export type DailyRecordCriticalValidationState = RootDailyRecordCriticalValidationState;
