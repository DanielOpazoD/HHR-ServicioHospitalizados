import type { DailyRecord } from '@/types/domain/dailyRecord';

export const createRecordDateTimestamp = (date: string): number =>
  new Date(`${date}T00:00:00`).getTime();

export const ensureDailyRecordDateTimestamp = (record: DailyRecord): void => {
  if (record.dateTimestamp || !record.date) {
    return;
  }

  record.dateTimestamp = createRecordDateTimestamp(record.date);
};

export const touchDailyRecordLastUpdated = (record: DailyRecord): void => {
  record.lastUpdated = new Date().toISOString();
};
