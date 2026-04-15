import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getForDateWithMeta,
  getMonthRecords,
} from '@/services/repositories/dailyRecordRepositoryReadService';
import type { DailyRecord } from '@/types/domain/dailyRecord';

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  getRecordForDate: vi.fn(),
  getPreviousDayRecord: vi.fn(),
  getAllDates: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getAvailableDatesFromFirestore: vi.fn(),
  getMonthRecordsFromFirestore: vi.fn(),
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => true),
}));

vi.mock('@/services/repositories/dailyRecordRemoteLoader', () => ({
  loadRemoteRecordWithFallback: vi.fn(),
}));

import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import { getMonthRecordsFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';

const buildRecord = (date: string, lastUpdated: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated,
    nurses: [],
    nursesDayShift: [],
    nursesNightShift: [],
    tensDayShift: [],
    tensNightShift: [],
    activeExtraBeds: [],
    handoffDayChecklist: {},
    handoffNightChecklist: {},
    handoffNightReceives: [],
    handoffNovedadesDayShift: '',
    handoffNovedadesNightShift: '',
    medicalHandoffNovedades: '',
    schemaVersion: 1,
  }) as DailyRecord;

describe('dailyRecordRepositoryReadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('keeps IndexedDB as source of truth when local record is newer than remote', async () => {
    const local = buildRecord('2026-03-19', '2026-03-19T12:00:00.000Z');
    const remote = buildRecord('2026-03-19', '2026-03-19T08:00:00.000Z');

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(local);
    vi.mocked(loadRemoteRecordWithFallback).mockResolvedValueOnce({
      record: remote,
      source: 'firestore',
      compatibilityTier: 'current_firestore',
      compatibilityIntensity: 'none',
      migrationRulesApplied: [],
      cachedLocally: false,
    });

    const result = await getForDateWithMeta('2026-03-19');

    expect(result.source).toBe('indexeddb');
    expect(result.record?.lastUpdated).toBe(local.lastUpdated);
    expect(result.sourceOfTruth).toBe('local');
    expect(result.consistencyState).not.toBe('remote_authoritative');
    expect(saveToIndexedDB).not.toHaveBeenCalled();
  });

  it('hydrates local cache when remote record is newer than local', async () => {
    const local = buildRecord('2026-03-19', '2026-03-19T08:00:00.000Z');
    const remote = buildRecord('2026-03-19', '2026-03-19T12:00:00.000Z');

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(local);
    vi.mocked(loadRemoteRecordWithFallback).mockResolvedValueOnce({
      record: remote,
      source: 'firestore',
      compatibilityTier: 'current_firestore',
      compatibilityIntensity: 'none',
      migrationRulesApplied: [],
      cachedLocally: false,
    });

    const result = await getForDateWithMeta('2026-03-19');

    expect(result.source).toBe('firestore');
    expect(result.record?.lastUpdated).toBe(remote.lastUpdated);
    expect(result.consistencyState).toBe('remote_authoritative');
    expect(saveToIndexedDB).toHaveBeenCalledWith(
      expect.objectContaining({
        date: remote.date,
        lastUpdated: remote.lastUpdated,
      })
    );
  });

  it('falls back to local with recoverable metadata when remote fetch fails', async () => {
    const local = buildRecord('2026-03-19', '2026-03-19T08:00:00.000Z');

    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(local);
    vi.mocked(loadRemoteRecordWithFallback).mockRejectedValueOnce(new Error('remote down'));

    const result = await getForDateWithMeta('2026-03-19');

    expect(result.source).toBe('indexeddb');
    expect(result.record?.lastUpdated).toBe(local.lastUpdated);
    expect(result.sourceOfTruth).toBe('local');
    expect(result.retryability).toBe('automatic_retry');
  });

  it('returns an explicit missing result when neither local nor remote has the record', async () => {
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(null);
    vi.mocked(loadRemoteRecordWithFallback).mockResolvedValueOnce({
      record: null,
      source: 'not_found',
      compatibilityTier: 'none',
      compatibilityIntensity: 'none',
      migrationRulesApplied: [],
      cachedLocally: false,
    });

    const result = await getForDateWithMeta('2026-03-19');

    expect(result.source).toBe('not_found');
    expect(result.consistencyState).toBe('missing');
    expect(result.userSafeMessage).toBe('No hay registro disponible para este día.');
  });

  it('delegates month record loading to firestore queries when remote sync is enabled', async () => {
    vi.mocked(getMonthRecordsFromFirestore).mockResolvedValueOnce([
      { date: '2026-03-19' },
    ] as DailyRecord[]);

    const result = await getMonthRecords(2026, 2);

    expect(getMonthRecordsFromFirestore).toHaveBeenCalledWith(2026, 2);
    expect(result).toEqual([{ date: '2026-03-19' }]);
  });
});
