import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import { preparePatchedRecordPersistence } from '@/services/repositories/dailyRecordPatchPersistenceController';

export const preparePatchedRecordForPersistence = (
  current: DailyRecord,
  date: string,
  patch: DailyRecordPatch
): { record: DailyRecord; mergedPatches: DailyRecordPatch } => {
  return preparePatchedRecordPersistence(current, date, patch);
};
