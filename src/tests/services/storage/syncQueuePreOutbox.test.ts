import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hospitalDB } from '@/services/storage/indexedDBService';

vi.mock('firebase/firestore', async importOriginal => {
  const actual = await importOriginal<typeof import('firebase/firestore')>();
  return {
    ...actual,
    setDoc: vi.fn().mockResolvedValue(undefined),
    getDoc: vi.fn().mockResolvedValue({ exists: () => false, data: () => undefined }),
  };
});

vi.mock('@/services/storage/firestore/firestoreShared', async importOriginal => {
  const actual =
    await importOriginal<typeof import('@/services/storage/firestore/firestoreShared')>();
  return {
    ...actual,
    getRecordDocRef: vi.fn(() => ({ id: 'sync-pre-outbox-doc-ref' })),
    sanitizeForFirestore: vi.fn(value => value),
  };
});

import { setDoc } from 'firebase/firestore';
import {
  ackDailyRecordSyncTask,
  queueDailyRecordSyncTaskWithLocalRecord,
  queueSyncTask,
} from '@/services/storage/sync';
import { resetSyncMutationIdentityForTests } from '@/services/storage/sync/syncMutationIdentity';
import type { DailyRecord } from '@/types/domain/dailyRecord';

const makeRecord = (date: string, marker: string): DailyRecord => ({
  date,
  beds: {},
  discharges: [],
  transfers: [],
  cma: [],
  lastUpdated: marker,
  nurses: [],
  activeExtraBeds: [],
});

describe('storage/sync pre-outbox guarantees', () => {
  beforeEach(async () => {
    await hospitalDB.syncQueue.clear();
    resetSyncMutationIdentityForTests();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });

  it('merges semantic changedPaths when a pending daily task is reused', async () => {
    await queueSyncTask(
      'UPDATE_DAILY_RECORD',
      makeRecord('2025-01-16', '2025-01-16T10:00:00.000Z'),
      {
        contexts: ['clinical'],
        origin: 'partial_update_retry',
        syncContract: {
          expectedVersion: '2025-01-16T09:55:00.000Z',
          changedPaths: ['beds.R1.pathology'],
          mutationId: 'mutation-first',
        },
      }
    );
    await queueSyncTask(
      'UPDATE_DAILY_RECORD',
      makeRecord('2025-01-16', '2025-01-16T10:05:00.000Z'),
      {
        contexts: ['handoff'],
        origin: 'partial_update_retry',
        syncContract: {
          expectedVersion: '2025-01-16T09:55:00.000Z',
          changedPaths: ['beds.R1.handoffNoteDayShift'],
          mutationId: 'mutation-second',
        },
      }
    );

    const [task] = await hospitalDB.syncQueue.toArray();

    expect(task.syncContract).toEqual(
      expect.objectContaining({
        changedPaths: ['beds.R1.pathology', 'beds.R1.handoffNoteDayShift'],
        mutationId: 'mutation-second',
        recordRevision: '2025-01-16T10:05:00.000Z',
      })
    );
  });

  it('keeps pre-outbox tasks pending until direct remote write ack removes the matching mutation', async () => {
    const record = makeRecord('2025-01-17', '2025-01-17T10:00:00.000Z');
    const syncContract = {
      expectedVersion: '2025-01-17T09:55:00.000Z',
      changedPaths: ['*'],
      mutationId: 'mutation-direct-save',
    };
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    const result = await queueDailyRecordSyncTaskWithLocalRecord(
      record,
      {
        contexts: ['clinical', 'staffing', 'movements', 'handoff', 'metadata'],
        origin: 'direct_queue',
        syncContract,
      },
      { deferProcessing: true }
    );

    expect(result).toMatchObject({ accepted: true, mode: 'created' });
    expect(setDoc).not.toHaveBeenCalled();
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(1);

    await expect(ackDailyRecordSyncTask(record, syncContract)).resolves.toBe(true);
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(0);
  });
});
