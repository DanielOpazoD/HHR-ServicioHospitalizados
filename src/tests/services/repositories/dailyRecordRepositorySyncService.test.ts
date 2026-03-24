import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types';

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  getRecordForDate: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock('@/services/storage/firestore', () => ({
  subscribeToRecord: vi.fn(),
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => true),
}));

vi.mock('@/services/repositories/dailyRecordRemoteLoader', () => ({
  loadRemoteRecordWithFallback: vi.fn(),
}));

import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import {
  subscribe,
  subscribeDetailed,
  syncWithFirestoreDetailed,
} from '@/services/repositories/dailyRecordRepositorySyncService';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import { subscribeToRecord } from '@/services/storage/firestore';

describe('dailyRecordRepositorySyncService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns clean outcome when remote record is resolved', async () => {
    vi.mocked(loadRemoteRecordWithFallback).mockResolvedValueOnce({
      record: { date: '2026-03-03', beds: {} } as DailyRecord,
    } as Awaited<ReturnType<typeof loadRemoteRecordWithFallback>>);

    const result = await syncWithFirestoreDetailed('2026-03-03');

    expect(result).toMatchObject({
      date: '2026-03-03',
      outcome: 'clean',
    });
  });

  it('returns blocked outcome when sync throws', async () => {
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(null);
    vi.mocked(loadRemoteRecordWithFallback).mockRejectedValueOnce(new Error('remote down'));

    const result = await syncWithFirestoreDetailed('2026-03-03');

    expect(result).toMatchObject({
      date: '2026-03-03',
      outcome: 'blocked',
      record: null,
      consistencyState: 'blocked',
    });
  });

  it('keeps the local record when it is newer than the remote copy', async () => {
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce({
      date: '2026-03-03',
      beds: {},
      lastUpdated: '2026-03-03T12:00:00.000Z',
    } as DailyRecord);
    vi.mocked(loadRemoteRecordWithFallback).mockResolvedValueOnce({
      record: {
        date: '2026-03-03',
        beds: {},
        lastUpdated: '2026-03-03T08:00:00.000Z',
      } as DailyRecord,
    } as Awaited<ReturnType<typeof loadRemoteRecordWithFallback>>);

    const result = await syncWithFirestoreDetailed('2026-03-03');

    expect(result).toMatchObject({
      date: '2026-03-03',
      outcome: 'clean',
      consistencyState: 'local_kept',
      sourceOfTruth: 'local',
    });
    expect(saveToIndexedDB).not.toHaveBeenCalled();
  });

  it('keeps the local record during subscription when Firestore emits a missing document', async () => {
    const localRecord = {
      date: '2026-03-03',
      beds: { R1: { patientName: 'Paciente Local' } },
      lastUpdated: '2026-03-03T12:00:00.000Z',
    } as unknown as DailyRecord;
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(localRecord);

    vi.mocked(subscribeToRecord).mockImplementationOnce((_date, callback) => {
      void callback(null, false);
      return vi.fn();
    });

    const callback = vi.fn();
    subscribe('2026-03-03', callback);

    await Promise.resolve();
    await Promise.resolve();

    expect(callback).toHaveBeenCalledWith(localRecord, false);
  });

  it('emits detailed subscription consistency when Firestore emits a missing document', async () => {
    const localRecord = {
      date: '2026-03-03',
      beds: { R1: { patientName: 'Paciente Local' } },
      lastUpdated: '2026-03-03T12:00:00.000Z',
    } as unknown as DailyRecord;
    vi.mocked(getRecordFromIndexedDB).mockResolvedValueOnce(localRecord);

    vi.mocked(subscribeToRecord).mockImplementationOnce((_date, callback) => {
      void callback(null, false);
      return vi.fn();
    });

    const callback = vi.fn();
    subscribeDetailed('2026-03-03', callback);

    await Promise.resolve();
    await Promise.resolve();

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        record: localRecord,
        consistencyState: 'missing_remote',
        sourceOfTruth: 'local',
      }),
      false
    );
  });
});
