import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { DailyRecord } from '@/types/domain/dailyRecord';

vi.mock('@/services/storage/firestore/firestoreRecordQueries', () => ({
  getRecordFromFirestore: vi.fn(),
}));

vi.mock('@/services/storage/sync', () => ({
  isRetryableSyncError: vi.fn(),
  queueSyncTask: vi.fn(),
}));

import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { isRetryableSyncError, queueSyncTask } from '@/services/storage/sync';
import {
  assertRemoteSaveCompatibility,
  resolveRemoteWriteRecovery,
} from '@/services/repositories/dailyRecordRemoteWriteController';

const buildRecord = (date: string, lastUpdated: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated,
    nurses: [],
    activeExtraBeds: [],
    schemaVersion: 1,
  }) as DailyRecord;

describe('dailyRecordRemoteWriteController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks remote saves when Firestore already has a newer schema version', async () => {
    vi.mocked(getRecordFromFirestore).mockResolvedValueOnce({
      ...buildRecord('2026-04-16', '2026-04-16T12:00:00.000Z'),
      schemaVersion: 999,
    } as DailyRecord);

    await expect(
      assertRemoteSaveCompatibility(
        '2026-04-16',
        buildRecord('2026-04-16', '2026-04-16T12:00:00.000Z')
      )
    ).rejects.toThrow('Tu aplicación está desactualizada');
  });

  it('queues retry recovery with retry metadata when the remote error is retryable', async () => {
    vi.mocked(isRetryableSyncError).mockReturnValue(true);
    vi.mocked(queueSyncTask).mockResolvedValueOnce({
      accepted: true,
      mode: 'created',
      pendingTasks: 1,
      maxPendingTasks: 192,
    });

    const result = await resolveRemoteWriteRecovery(
      '2026-04-16',
      buildRecord('2026-04-16', '2026-04-16T12:00:00.000Z'),
      ['beds.R1.patientName'],
      new Error('network down')
    );

    expect(result.status).toBe('queued_for_retry');
    expect(queueSyncTask).toHaveBeenCalledWith(
      'UPDATE_DAILY_RECORD',
      expect.objectContaining({ date: '2026-04-16' }),
      expect.objectContaining({
        origin: 'partial_update_retry',
      })
    );
  });
});
