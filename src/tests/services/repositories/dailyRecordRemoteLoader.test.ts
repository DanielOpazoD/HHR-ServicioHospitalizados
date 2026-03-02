import { beforeEach, describe, expect, it, vi } from 'vitest';

import { loadRemoteRecordWithFallback } from '@/services/repositories/dailyRecordRemoteLoader';
import { DataFactory } from '@/tests/factories/DataFactory';

vi.mock('@/services/storage/firestoreService', () => ({
  getRecordFromFirestore: vi.fn(),
}));

vi.mock('@/services/storage/indexedDBService', () => ({
  saveRecord: vi.fn(),
}));

import { getRecordFromFirestore } from '@/services/storage/firestoreService';
import { saveRecord } from '@/services/storage/indexedDBService';

describe('dailyRecordRemoteLoader', () => {
  const date = '2025-01-01';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns firestore metadata when the primary remote record exists', async () => {
    vi.mocked(getRecordFromFirestore).mockResolvedValue(
      DataFactory.createMockDailyRecord(date, { schemaVersion: 1 })
    );

    const result = await loadRemoteRecordWithFallback(date);

    expect(result.source).toBe('firestore');
    expect(result.compatibilityTier).toBe('current_firestore');
    expect(result.compatibilityIntensity).toBe('normalized_only');
    expect(result.cachedLocally).toBe(true);
    expect(result.migrationRulesApplied).toContain('schema_defaults_applied');
    expect(saveRecord).toHaveBeenCalled();
  });

  it('returns not_found metadata when neither remote source has data', async () => {
    vi.mocked(getRecordFromFirestore).mockResolvedValue(null);

    const result = await loadRemoteRecordWithFallback(date);

    expect(result.record).toBeNull();
    expect(result.source).toBe('not_found');
    expect(result.compatibilityTier).toBe('none');
    expect(result.compatibilityIntensity).toBe('none');
    expect(result.cachedLocally).toBe(false);
    expect(result.migrationRulesApplied).toEqual([]);
  });

  it('deduplicates concurrent remote loads for the same date', async () => {
    let resolveRemote:
      | ((value: ReturnType<typeof DataFactory.createMockDailyRecord>) => void)
      | undefined;

    vi.mocked(getRecordFromFirestore).mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveRemote = resolve;
        })
    );

    const firstCall = loadRemoteRecordWithFallback(date);
    const secondCall = loadRemoteRecordWithFallback(date);

    if (!resolveRemote) {
      throw new Error('Remote resolver was not captured');
    }

    resolveRemote(DataFactory.createMockDailyRecord(date));
    const [firstResult, secondResult] = await Promise.all([firstCall, secondCall]);

    expect(getRecordFromFirestore).toHaveBeenCalledTimes(1);
    expect(firstResult.record?.date).toBe(date);
    expect(secondResult.record?.date).toBe(date);
  });

  it('does not consult legacy storage in the hot path anymore', async () => {
    vi.mocked(getRecordFromFirestore).mockResolvedValue(null);

    const result = await loadRemoteRecordWithFallback(date);

    expect(result.source).toBe('not_found');
    expect(saveRecord).not.toHaveBeenCalled();
  });
});
