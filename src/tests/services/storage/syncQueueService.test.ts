import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hospitalDB } from '@/services/storage/indexedDBService';
import { logError } from '@/services/utils/errorService';

vi.mock('@/services/infrastructure/db', () => ({
  db: {
    setDoc: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('@/services/utils/errorService', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/utils/errorService')>();
  return {
    ...actual,
    logError: vi.fn(),
  };
});

import { db } from '@/services/infrastructure/db';
import {
  queueSyncTask,
  processSyncQueue,
  getSyncQueueStats,
  getSyncQueueTelemetry,
} from '@/services/storage/syncQueueService';
import { DailyRecord } from '@/types';

describe('syncQueueService', () => {
  const FIXED_NOW = 1760000000000;

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

  beforeEach(async () => {
    await hospitalDB.syncQueue.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });

  it('deduplicates tasks by record date', async () => {
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-01', 'v1'));
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-01', 'v2'));

    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);
    const payload = tasks[0].payload as DailyRecord;
    expect(payload.lastUpdated).toBe('v2');
  });

  it('backs off and retries when sync fails', async () => {
    vi.mocked(db.setDoc).mockRejectedValueOnce(new Error('Network down'));

    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-02', 'v1'));
    await processSyncQueue();

    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('PENDING');
    expect(tasks[0].retryCount).toBe(1);
    expect(tasks[0].nextAttemptAt || 0).toBeGreaterThan(FIXED_NOW - 1000);
  });

  it('reports queue stats', async () => {
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-03', 'v1'));
    const stats = await getSyncQueueStats();
    expect(stats.pending).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.conflict).toBe(0);
  });

  it('reports telemetry including retrying and oldest pending age', async () => {
    vi.mocked(db.setDoc).mockRejectedValueOnce(new Error('Network down'));
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-06', 'v1'));
    await processSyncQueue();

    const telemetry = await getSyncQueueTelemetry();
    expect(telemetry.pending).toBe(1);
    expect(telemetry.retrying).toBe(1);
    expect(telemetry.oldestPendingAgeMs).toBeGreaterThanOrEqual(0);
    expect(telemetry.batchSize).toBeGreaterThan(0);
  });

  it('marks task as failed without retry for non-retryable errors', async () => {
    vi.mocked(db.setDoc).mockRejectedValueOnce({
      code: 'permission-denied',
      message: 'Missing or insufficient permissions',
    });

    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-04', 'v1'));
    await processSyncQueue();

    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('FAILED');
    expect(tasks[0].retryCount).toBe(0);
    expect(tasks[0].lastErrorCode).toBe('permission-denied');
    expect(tasks[0].lastErrorCategory).toBe('authorization');
  });

  it('marks task as conflict when remote concurrency conflict occurs', async () => {
    const conflictError = new Error('Concurrency conflict');
    conflictError.name = 'ConcurrencyError';
    vi.mocked(db.setDoc).mockRejectedValueOnce(conflictError);

    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-05', 'v1'));
    await processSyncQueue();

    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('CONFLICT');
    expect(tasks[0].lastErrorCategory).toBe('conflict');
  });

  it('does not process tasks scheduled for a future retry window', async () => {
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-07', 'v1'));
    await hospitalDB.syncQueue
      .where('status')
      .equals('PENDING')
      .modify(task => {
        task.nextAttemptAt = Date.now() + 60_000;
      });

    await processSyncQueue();

    expect(vi.mocked(db.setDoc)).not.toHaveBeenCalled();
    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('PENDING');
  });

  it('marks task as failed after exhausting max retries', async () => {
    vi.mocked(db.setDoc).mockRejectedValue(new Error('Network down'));

    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-08', 'v1'));

    for (let attempt = 0; attempt < 5; attempt++) {
      await hospitalDB.syncQueue
        .where('status')
        .equals('PENDING')
        .modify(task => {
          task.nextAttemptAt = 0;
        });
      await processSyncQueue();
    }

    const tasks = await hospitalDB.syncQueue.toArray();
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe('FAILED');
    expect(tasks[0].retryCount).toBe(5);
    expect(vi.mocked(logError)).toHaveBeenCalledWith(
      'Sync task permanently failed',
      expect.any(Error),
      expect.objectContaining({
        type: 'UPDATE_DAILY_RECORD',
        retryCount: 5,
      })
    );
  });
});
