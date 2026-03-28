import { toRecordTimestamp as toPolicyRecordTimestamp } from '@/services/repositories/dailyRecordConsistencyPolicy';

export const toRecordTimestamp = toPolicyRecordTimestamp;

type TimestampedRecord = {
  lastUpdated: string;
};

export const shouldKeepLocalRecordOverRemote = <T extends TimestampedRecord>(
  localRecord: T | null,
  remoteRecord: T | null
): boolean => {
  if (!localRecord || !remoteRecord) return false;
  return toRecordTimestamp(localRecord.lastUpdated) > toRecordTimestamp(remoteRecord.lastUpdated);
};

export const resolvePreferredDailyRecord = <T extends TimestampedRecord>(
  localRecord: T | null,
  remoteRecord: T | null
): T | null => {
  if (!remoteRecord) {
    return localRecord;
  }

  return shouldKeepLocalRecordOverRemote(localRecord, remoteRecord) ? localRecord : remoteRecord;
};

export const mergeAvailableDates = (localDates: string[], remoteDates: string[]): string[] =>
  Array.from(new Set([...localDates, ...remoteDates]))
    .sort()
    .reverse();
