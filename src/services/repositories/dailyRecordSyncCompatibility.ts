import { DailyRecord } from '@/types/core';
import { toRecordTimestamp as toPolicyRecordTimestamp } from '@/services/repositories/dailyRecordConsistencyPolicy';

export const toRecordTimestamp = toPolicyRecordTimestamp;

export const shouldKeepLocalRecordOverRemote = (
  localRecord: DailyRecord | null,
  remoteRecord: DailyRecord | null
): boolean => {
  if (!localRecord || !remoteRecord) return false;
  return toRecordTimestamp(localRecord.lastUpdated) > toRecordTimestamp(remoteRecord.lastUpdated);
};

export const resolvePreferredDailyRecord = (
  localRecord: DailyRecord | null,
  remoteRecord: DailyRecord | null
): DailyRecord | null => {
  if (!remoteRecord) {
    return localRecord;
  }

  return shouldKeepLocalRecordOverRemote(localRecord, remoteRecord) ? localRecord : remoteRecord;
};

export const mergeAvailableDates = (localDates: string[], remoteDates: string[]): string[] =>
  Array.from(new Set([...localDates, ...remoteDates]))
    .sort()
    .reverse();
