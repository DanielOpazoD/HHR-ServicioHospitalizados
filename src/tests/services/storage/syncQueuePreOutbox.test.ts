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

import { getDoc, setDoc } from 'firebase/firestore';
import {
  ackDailyRecordSyncTask,
  queueDailyRecordSyncTaskWithLocalRecord,
  queueSyncTask,
  releaseDailyRecordPreOutboxHold,
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
        mutationIds: ['mutation-first', 'mutation-second'],
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

  it('holds pre-outbox tasks so another worker cannot process them immediately', async () => {
    const record = makeRecord('2025-01-18', '2025-01-18T10:00:00.000Z');
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    await queueDailyRecordSyncTaskWithLocalRecord(
      record,
      {
        contexts: ['clinical'],
        origin: 'direct_queue',
        syncContract: {
          expectedVersion: '2025-01-18T09:55:00.000Z',
          changedPaths: ['beds.R1.pathology'],
          mutationId: 'mutation-held-direct-save',
        },
      },
      { deferProcessing: true, holdForMs: 5_000 }
    );

    const [task] = await hospitalDB.syncQueue.toArray();
    expect(task.nextAttemptAt || 0).toBeGreaterThan(Date.now());

    const { processSyncQueue } = await import('@/services/storage/sync');
    await processSyncQueue();

    expect(setDoc).not.toHaveBeenCalled();
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(1);
  });

  it('uses an explicit pre-outbox remote-ack hold that can be released after remote failure', async () => {
    const record = makeRecord('2025-01-20', '2025-01-20T10:00:00.000Z');
    const syncContract = {
      expectedVersion: '2025-01-20T09:55:00.000Z',
      changedPaths: ['beds.R1.pathology'],
      mutationId: 'mutation-explicit-hold',
      tabId: 'tab-direct-writer',
    };
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    await queueDailyRecordSyncTaskWithLocalRecord(
      record,
      {
        contexts: ['clinical'],
        origin: 'direct_queue',
        syncContract,
      },
      {
        deferProcessing: true,
        holdForMs: 60_000,
        preOutboxHoldOwner: 'tab-direct-writer',
        preOutboxHoldReason: 'awaiting_remote_ack',
      }
    );

    await hospitalDB.syncQueue
      .where('status')
      .equals('PENDING')
      .modify(task => {
        task.nextAttemptAt = 0;
      });

    await (await import('@/services/storage/sync')).processSyncQueue();
    expect(setDoc).not.toHaveBeenCalled();

    const [heldTask] = await hospitalDB.syncQueue.toArray();
    expect(heldTask.preOutboxHoldOwner).toBe('tab-direct-writer');
    expect(heldTask.preOutboxHoldReason).toBe('awaiting_remote_ack');
    expect(heldTask.preOutboxHoldUntil || 0).toBeGreaterThan(Date.now());

    await expect(releaseDailyRecordPreOutboxHold(record, syncContract)).resolves.toBe(true);

    const [releasedTask] = await hospitalDB.syncQueue.toArray();
    expect(releasedTask.preOutboxHoldOwner).toBeUndefined();
    expect(releasedTask.preOutboxHoldUntil).toBeUndefined();

    await (await import('@/services/storage/sync')).processSyncQueue();
    expect(setDoc).toHaveBeenCalledTimes(1);
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(0);
  });

  it('drains the outbox without rewriting when remote already has the same mutationId', async () => {
    const record = makeRecord('2025-01-19', '2025-01-19T10:00:00.000Z');
    vi.mocked(getDoc).mockResolvedValue({
      exists: () => true,
      data: () => ({
        ...record,
        lastUpdated: '2025-01-19T10:05:00.000Z',
        meta: {
          revision: 3,
          lastMutationId: 'mutation-already-applied',
          lastChangedPaths: ['beds.R1.pathology'],
        },
      }),
    } as Awaited<ReturnType<typeof getDoc>>);

    await queueDailyRecordSyncTaskWithLocalRecord(record, {
      contexts: ['clinical'],
      origin: 'direct_queue',
      syncContract: {
        expectedVersion: '2025-01-19T09:55:00.000Z',
        changedPaths: ['beds.R1.pathology'],
        mutationId: 'mutation-already-applied',
      },
    });

    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    const { processSyncQueue } = await import('@/services/storage/sync');
    await processSyncQueue();

    expect(setDoc).not.toHaveBeenCalled();
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(0);
  });
});
