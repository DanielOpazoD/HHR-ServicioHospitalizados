import type { DailyRecord as RootDailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch as RootDailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import type { DailyRecordDateRef as RootDailyRecordDateRef } from '@/types/domain/dailyRecordSlices';

/**
 * Core application-facing daily record contracts.
 *
 * This is the default entrypoint for general record read/update flows that do
 * not need bed-, staffing- or medical-specific slices.
 */
export type DailyRecord = RootDailyRecord;
export type DailyRecordPatch = RootDailyRecordPatch;
export type DailyRecordDateRef = RootDailyRecordDateRef;
