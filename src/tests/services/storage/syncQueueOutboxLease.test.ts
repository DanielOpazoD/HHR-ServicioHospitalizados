import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hospitalDB } from '@/services/storage/indexedDBService';
import { queueDailyRecordSyncTaskWithLocalRecord, queueSyncTask } from '@/services/storage/sync';
import { createDexieSyncQueueStore } from '@/services/storage/sync/dexieSyncQueueStore';
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

describe('sync queue transactional outbox and leases', () => {
  beforeEach(async () => {
    await hospitalDB.dailyRecords.clear();
    await hospitalDB.syncQueue.clear();
    vi.restoreAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });

  it('persists a local daily record and its outbox task in one operation', async () => {
    const record = makeRecord('2025-01-16', '2025-01-16T10:00:00.000Z');

    const result = await queueDailyRecordSyncTaskWithLocalRecord(record, {
      contexts: ['clinical'],
      origin: 'partial_update_retry',
      syncContract: {
        expectedVersion: '2025-01-16T09:00:00.000Z',
        changedPaths: ['beds.R1.pathology'],
      },
    });

    expect(result).toMatchObject({
      accepted: true,
      mode: 'created',
    });
    await expect(hospitalDB.dailyRecords.get('2025-01-16')).resolves.toMatchObject({
      lastUpdated: '2025-01-16T10:00:00.000Z',
    });
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(1);
  });

  it('rolls back the outbox task when the local record write fails', async () => {
    const record = makeRecord('2025-01-17', '2025-01-17T10:00:00.000Z');
    const store = createDexieSyncQueueStore();
    vi.spyOn(hospitalDB.dailyRecords, 'put').mockRejectedValueOnce(
      new Error('record write failed')
    );

    await expect(
      store.saveDailyRecordWithTask(record, {
        opId: 'test-op',
        type: 'UPDATE_DAILY_RECORD',
        payload: record,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
        key: 'daily:2025-01-17',
      })
    ).rejects.toThrow('record write failed');

    await expect(hospitalDB.dailyRecords.get('2025-01-17')).resolves.toBeUndefined();
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(0);
  });

  it('rolls back the local record when the outbox task write fails', async () => {
    const record = makeRecord('2025-01-18', '2025-01-18T10:00:00.000Z');
    const store = createDexieSyncQueueStore();
    vi.spyOn(hospitalDB.syncQueue, 'add').mockRejectedValueOnce(new Error('queue write failed'));

    await expect(
      store.saveDailyRecordWithTask(record, {
        opId: 'test-op',
        type: 'UPDATE_DAILY_RECORD',
        payload: record,
        timestamp: Date.now(),
        retryCount: 0,
        status: 'PENDING',
        key: 'daily:2025-01-18',
      })
    ).rejects.toThrow('queue write failed');

    await expect(hospitalDB.dailyRecords.get('2025-01-18')).resolves.toBeUndefined();
    await expect(hospitalDB.syncQueue.toArray()).resolves.toHaveLength(0);
  });

  it('claims ready pending tasks with a durable lease so another worker cannot claim them', async () => {
    const store = createDexieSyncQueueStore();
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-19', 'v1'));
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-20', 'v1'));

    const firstClaim = await store.claimReadyPending(1760000000000, 1, null, {
      leaseOwner: 'worker-a',
      leaseUntil: 1760000030000,
      attemptId: 'attempt-a',
    });
    const secondClaim = await store.claimReadyPending(1760000000000, 2, null, {
      leaseOwner: 'worker-b',
      leaseUntil: 1760000030000,
      attemptId: 'attempt-b',
    });

    expect(firstClaim).toHaveLength(1);
    expect(firstClaim[0]).toMatchObject({
      status: 'PROCESSING',
      leaseOwner: 'worker-a',
      attemptId: 'attempt-a',
    });
    expect(secondClaim).toHaveLength(1);
    expect(secondClaim[0].key).not.toBe(firstClaim[0].key);
  });

  it('reclaims expired processing leases', async () => {
    const store = createDexieSyncQueueStore();
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-21', 'v1'));
    await hospitalDB.syncQueue
      .where('status')
      .equals('PENDING')
      .modify(task => {
        task.status = 'PROCESSING';
        task.leaseOwner = 'stale-worker';
        task.leaseUntil = 1760000000000 - 1;
        task.attemptId = 'stale-attempt';
      });

    const reclaimed = await store.claimReadyPending(1760000000000, 1, null, {
      leaseOwner: 'worker-fresh',
      leaseUntil: 1760000030000,
      attemptId: 'attempt-fresh',
    });

    expect(reclaimed).toHaveLength(1);
    expect(reclaimed[0]).toMatchObject({
      status: 'PROCESSING',
      leaseOwner: 'worker-fresh',
      leaseUntil: 1760000030000,
      attemptId: 'attempt-fresh',
    });
  });
});
