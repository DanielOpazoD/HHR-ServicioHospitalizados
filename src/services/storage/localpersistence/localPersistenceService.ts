import { DailyRecord } from '@/types';
import { safeJsonParse } from '@/utils/jsonUtils';
import {
  DEMO_STORAGE_KEY,
  STORAGE_KEY,
  getClosestPreviousRecord,
  hasBrowserLocalStorage,
  readLocalStorageJson,
  writeLocalStorageJson,
} from '@/services/storage/localstorage/localStorageCore';

const SETTINGS_INDEX_KEY = 'hhr_fallback_settings_index';

const getSettingsIndex = (): string[] => readLocalStorageJson<string[]>(SETTINGS_INDEX_KEY, []);

const saveSettingsIndex = (keys: string[]): void => {
  writeLocalStorageJson(SETTINGS_INDEX_KEY, Array.from(new Set(keys)).sort());
};

const trackSettingKey = (key: string): void => {
  const keys = getSettingsIndex();
  if (!keys.includes(key)) {
    saveSettingsIndex([...keys, key]);
  }
};

const untrackSettingKey = (key: string): void => {
  const keys = getSettingsIndex();
  if (keys.includes(key)) {
    saveSettingsIndex(keys.filter(current => current !== key));
  }
};

const getRecords = (key: string): Record<string, DailyRecord> =>
  readLocalStorageJson<Record<string, DailyRecord>>(key, {});

const saveRecords = (key: string, records: Record<string, DailyRecord>): void => {
  writeLocalStorageJson(key, records);
};

const createRecordStore = (key: string) => ({
  getAll: (): Record<string, DailyRecord> => getRecords(key),
  getForDate: (date: string): DailyRecord | null => getRecords(key)[date] || null,
  save: (record: DailyRecord): void => {
    const records = getRecords(key);
    records[record.date] = record;
    saveRecords(key, records);
  },
  deleteForDate: (date: string): void => {
    const records = getRecords(key);
    delete records[date];
    saveRecords(key, records);
  },
  clear: (): void => {
    if (!hasBrowserLocalStorage()) return;
    window.localStorage.removeItem(key);
  },
  getAllDates: (): string[] => Object.keys(getRecords(key)).sort().reverse(),
  getRecordsForMonth: (year: number, month: number): DailyRecord[] => {
    const prefix = `${year}-${String(month).padStart(2, '0')}`;
    return Object.values(getRecords(key)).filter(record => record.date.startsWith(prefix));
  },
  getPreviousDayRecord: (currentDate: string): DailyRecord | null =>
    getClosestPreviousRecord(getRecords(key), currentDate),
});

const records = createRecordStore(STORAGE_KEY);
const demoRecords = createRecordStore(DEMO_STORAGE_KEY);

const settings = {
  get: <T>(id: string, defaultValue: T): T => {
    if (!hasBrowserLocalStorage()) return defaultValue;
    const raw = window.localStorage.getItem(id);
    if (raw == null) return defaultValue;
    return safeJsonParse<T>(raw, raw as T);
  },
  save: (id: string, value: unknown): void => {
    if (!hasBrowserLocalStorage()) return;
    if (value === null || value === undefined) {
      window.localStorage.removeItem(id);
      untrackSettingKey(id);
      return;
    }
    window.localStorage.setItem(id, JSON.stringify(value));
    trackSettingKey(id);
  },
  clearAll: (): void => {
    if (!hasBrowserLocalStorage()) return;
    const keys = getSettingsIndex();
    keys.forEach(key => window.localStorage.removeItem(key));
    window.localStorage.removeItem(SETTINGS_INDEX_KEY);
  },
};

export const localPersistence = {
  records,
  demoRecords,
  settings,
};
