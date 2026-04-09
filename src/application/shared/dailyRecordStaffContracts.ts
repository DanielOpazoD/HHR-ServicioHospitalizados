import type {
  DailyRecordCudyrExportState as RootDailyRecordCudyrExportState,
  DailyRecordStaffingState as RootDailyRecordStaffingState,
} from '@/types/domain/dailyRecordSlices';

/**
 * Staffing/export-facing slices of the daily record contract.
 */
export type DailyRecordStaffingState = RootDailyRecordStaffingState;
export type DailyRecordCudyrExportState = RootDailyRecordCudyrExportState;
