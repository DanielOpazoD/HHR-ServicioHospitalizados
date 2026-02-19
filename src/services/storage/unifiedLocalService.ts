import type { DailyRecord } from '@/types';
import {
  clearAllDemoRecords,
  getAllDates,
  getAllDemoRecords,
  getAllRecords,
  getCatalog,
  getDemoRecordForDate,
  getPreviousDayRecord,
  getPreviousDemoDayRecord,
  getRecordForDate,
  saveCatalog,
  saveDemoRecord,
  saveRecord,
} from '@/services/storage/indexedDBService';
import { NURSES_STORAGE_KEY, STORAGE_KEY } from '@/services/storage/localstorage/localStorageCore';
import {
  clearAllData as clearAllLegacyLocalData,
  isLocalStorageAvailable,
} from '@/services/storage/localstorage/localStorageMaintenanceService';

export { STORAGE_KEY, NURSES_STORAGE_KEY, isLocalStorageAvailable };

export const getStoredRecords = getAllRecords;
export const saveRecordLocal = saveRecord;

export const getStoredNurses = (): Promise<string[]> => getCatalog('nurses');
export const saveStoredNurses = (nurses: string[]): Promise<void> => saveCatalog('nurses', nurses);

export const getDemoRecords = getAllDemoRecords;
export const clearAllDemoData = clearAllDemoRecords;
export const getAllDemoDates = async (): Promise<string[]> => {
  const records = await getAllDemoRecords();
  return Object.keys(records).sort().reverse();
};

export const saveDemoRecords = async (records: DailyRecord[]): Promise<void> => {
  await Promise.all(records.map(record => saveDemoRecord(record)));
};

export {
  getRecordForDate,
  getAllDates,
  getPreviousDayRecord,
  saveDemoRecord,
  getDemoRecordForDate,
  getPreviousDemoDayRecord,
};

export const clearAllData = clearAllLegacyLocalData;
