import { DailyRecord } from '@/types';
import { localPersistence } from '@/services/storage/localpersistence/localPersistenceService';
import { buildMonthRecordPrefix } from '@/services/storage/storageDateSupport';

import { ensureDbReady, hospitalDB as db, isDatabaseInFallbackMode } from './indexedDbCore';

const toRecordMap = (records: DailyRecord[]): Record<string, DailyRecord> => {
  const result: Record<string, DailyRecord> = {};
  for (const record of records) {
    result[record.date] = record;
  }
  return result;
};

const sortRecordsDescending = (records: DailyRecord[]): DailyRecord[] =>
  [...records].sort((a, b) => b.date.localeCompare(a.date));

export const getAllRecords = async (): Promise<Record<string, DailyRecord>> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getAll();
    }
    const records = await db.dailyRecords.toArray();
    return toRecordMap(records);
  } catch (error) {
    console.error('Failed to get all records from IndexedDB:', error);
    return {};
  }
};

export const getRecordsForMonth = async (year: number, month: number): Promise<DailyRecord[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return sortRecordsDescending(await localPersistence.records.getRecordsForMonth(year, month));
    }
    return sortRecordsDescending(
      await db.dailyRecords.where('date').startsWith(buildMonthRecordPrefix(year, month)).toArray()
    );
  } catch (error) {
    console.error(`Failed to get records for month ${year}-${month}:`, error);
    return [];
  }
};

export const getRecordsRange = async (
  startDate: string,
  endDate: string
): Promise<DailyRecord[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getRecordsRange(startDate, endDate);
    }

    return await db.dailyRecords.where('date').between(startDate, endDate, true, true).toArray();
  } catch (error) {
    console.error(`Failed to get records in range ${startDate} to ${endDate}:`, error);
    return [];
  }
};

export const getRecordForDate = async (date: string): Promise<DailyRecord | null> => {
  try {
    await ensureDbReady();

    if (
      isDatabaseInFallbackMode() &&
      typeof window !== 'undefined' &&
      window.__HHR_E2E_OVERRIDE__
    ) {
      const override = window.__HHR_E2E_OVERRIDE__;
      if (override[date]) return override[date];
    }

    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getForDate(date);
    }

    const record = await db.dailyRecords.get(date);
    return record || null;
  } catch (error) {
    console.error(`Failed to get record for ${date}:`, error);
    return null;
  }
};

export const saveRecord = async (record: DailyRecord): Promise<void> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      localPersistence.records.save(record);
      return;
    }
    await db.dailyRecords.put(record);
  } catch (error) {
    console.error('Failed to save record to IndexedDB:', error);
  }
};

export const saveRecords = async (records: DailyRecord[]): Promise<void> => {
  try {
    await ensureDbReady();
    if (records.length === 0) {
      return;
    }

    if (isDatabaseInFallbackMode()) {
      records.forEach(record => {
        localPersistence.records.save(record);
      });
      return;
    }

    await db.dailyRecords.bulkPut(records);
  } catch (error) {
    console.error('Failed to save records to IndexedDB:', error);
  }
};

export const deleteRecord = async (date: string): Promise<void> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      localPersistence.records.deleteForDate(date);
      return;
    }
    await db.dailyRecords.delete(date);
  } catch (error) {
    console.error('Failed to delete record from IndexedDB:', error);
  }
};

export const getAllDates = async (): Promise<string[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getAllDates();
    }
    const records = await db.dailyRecords.orderBy('date').reverse().keys();
    return records as string[];
  } catch (error) {
    console.error('Failed to get all dates from IndexedDB:', error);
    return [];
  }
};

export const getAllRecordsSorted = async (): Promise<DailyRecord[]> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return sortRecordsDescending(Object.values(await localPersistence.records.getAll()));
    }

    return await db.dailyRecords.orderBy('date').reverse().toArray();
  } catch (error) {
    console.error('Failed to get sorted records from IndexedDB:', error);
    return [];
  }
};

export const getPreviousDayRecord = async (currentDate: string): Promise<DailyRecord | null> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      return localPersistence.records.getPreviousDayRecord(currentDate);
    }
    const record = await db.dailyRecords.where('date').below(currentDate).reverse().first();
    return record || null;
  } catch (error) {
    console.error('Failed to get previous day record:', error);
    return null;
  }
};

export const clearAllRecords = async (): Promise<void> => {
  try {
    await ensureDbReady();
    if (isDatabaseInFallbackMode()) {
      localPersistence.records.clear();
      return;
    }
    await db.dailyRecords.clear();
  } catch (error) {
    console.error('Failed to clear all records from IndexedDB:', error);
  }
};
