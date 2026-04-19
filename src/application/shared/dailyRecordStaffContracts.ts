import type {
  DailyRecordCudyrExportState as RootDailyRecordCudyrExportState,
  DailyRecordStaffingState as RootDailyRecordStaffingState,
} from '@/types/domain/dailyRecordSlices';
import type {
  DailyRecordStaffingDetailsV1 as RootDailyRecordStaffingDetailsV1,
  DetailedStaffAssignment as RootDetailedStaffAssignment,
  DetailedStaffingRole as RootDetailedStaffingRole,
  DetailedStaffingShift as RootDetailedStaffingShift,
} from '@/types/domain/dailyRecordStaffingDetails';

/**
 * Staffing/export-facing slices of the daily record contract.
 */
export type DailyRecordStaffingState = RootDailyRecordStaffingState;
export type DailyRecordCudyrExportState = RootDailyRecordCudyrExportState;
export type DailyRecordStaffingDetailsV1 = RootDailyRecordStaffingDetailsV1;
export type DetailedStaffAssignment = RootDetailedStaffAssignment;
export type DetailedStaffingRole = RootDetailedStaffingRole;
export type DetailedStaffingShift = RootDetailedStaffingShift;
