import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { hospitalDB } from '@/services/storage/indexedDBService';

vi.mock('@/services/infrastructure/db', () => ({
  db: {
    setDoc: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '@/services/infrastructure/db';
import {
  queueSyncTask,
  processSyncQueue,
  getSyncQueueStats,
} from '@/services/storage/syncQueueService';
import { DailyRecord } from '@/types';

describe('syncQueueService', () => {
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
    expect(tasks[0].nextAttemptAt || 0).toBeGreaterThan(Date.now() - 1000);
  });

  it('reports queue stats', async () => {
    await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord('2025-01-03', 'v1'));
    const stats = await getSyncQueueStats();
    expect(stats.pending).toBe(1);
    expect(stats.failed).toBe(0);
    expect(stats.conflict).toBe(0);
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
  });
});
