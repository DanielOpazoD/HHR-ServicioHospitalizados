import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types';

vi.mock('@/services/storage/indexeddb/indexedDbRecordService', () => ({
  getRecordForDate: vi.fn(),
  saveRecord: vi.fn(),
}));

vi.mock('@/services/storage/firestoreService', () => ({
  subscribeToRecord: vi.fn(),
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  isFirestoreEnabled: vi.fn(() => true),
}));

vi.mock('@/services/repositories/dailyRecordRemoteLoader', () => ({
  loadRemoteRecordWithFallback: vi.fn(),
}));

vi.mock('@/services/repositories/dailyRecordSyncCompatibility', () => ({
  resolvePreferredDailyRecord: vi.fn((_local, remote) => remote),
}));

import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import { syncWithFirestoreDetailed } from '@/services/repositories/dailyRecordRepositorySyncService';
import { getRecordForDate as getRecordFromIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';

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
});
