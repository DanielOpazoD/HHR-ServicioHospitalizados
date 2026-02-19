import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it } from 'vitest';
import type { DailyRecord } from '@/types';
import {
  clearAllData,
  clearAllDemoData,
  getAllDates,
  getAllDemoDates,
  getDemoRecordForDate,
  getRecordForDate,
  getStoredNurses,
  getStoredRecords,
  NURSES_STORAGE_KEY,
  STORAGE_KEY,
  isLocalStorageAvailable,
  saveDemoRecord,
  saveDemoRecords,
  saveRecordLocal,
  saveStoredNurses,
} from '@/services/storage/unifiedLocalService';

const buildRecord = (date: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: new Date().toISOString(),
  nurses: [],
  activeExtraBeds: [],
});

describe('unifiedLocalService', () => {
  beforeEach(async () => {
    localStorage.clear();
    await clearAllDemoData();
  });

  it('saves and reads records via unified local facade', async () => {
    await saveRecordLocal(buildRecord('2026-01-15'));
    await saveRecordLocal(buildRecord('2026-01-16'));

    const map = await getStoredRecords();
    const one = await getRecordForDate('2026-01-15');
    const dates = await getAllDates();

    expect(Object.keys(map)).toHaveLength(2);
    expect(one?.date).toBe('2026-01-15');
    expect(dates[0]).toBe('2026-01-16');
  });

  it('saves and reads nurse catalog via unified local facade', async () => {
    await saveStoredNurses(['Nurse A', 'Nurse B']);
    const nurses = await getStoredNurses();
    expect(nurses).toEqual(['Nurse A', 'Nurse B']);
  });

  it('saves and reads demo records via unified local facade', async () => {
    await saveDemoRecord(buildRecord('2026-02-10'));
    await saveDemoRecords([buildRecord('2026-02-11'), buildRecord('2026-02-12')]);

    const dates = await getAllDemoDates();
    const record = await getDemoRecordForDate('2026-02-12');

    expect(dates).toEqual(['2026-02-12', '2026-02-11', '2026-02-10']);
    expect(record?.date).toBe('2026-02-12');
  });

  it('keeps localStorage maintenance API for compatibility', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ '2026-01-01': buildRecord('2026-01-01') }));
    localStorage.setItem(NURSES_STORAGE_KEY, JSON.stringify(['A']));
    localStorage.setItem('dummy', '1');
    expect(isLocalStorageAvailable()).toBe(true);
    clearAllData();
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(NURSES_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('dummy')).toBe('1');
  });
});
