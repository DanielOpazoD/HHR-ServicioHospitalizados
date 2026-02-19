import 'fake-indexeddb/auto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hospitalDB } from '@/services/storage/indexedDBService';
import {
  getSyncQueueTelemetry,
  processSyncQueue,
  queueSyncTask,
} from '@/services/storage/syncQueueService';
import { DailyRecord } from '@/types';

vi.mock('@/services/infrastructure/db', () => ({
  db: {
    setDoc: vi.fn().mockResolvedValue(undefined),
  },
}));

import { db } from '@/services/infrastructure/db';

const toInt = (raw: string | undefined, fallback: number): number => {
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const LOAD_VOLUME = toInt(process.env.SYNC_QUEUE_LOAD_VOLUME, 120);
const RETRY_VOLUME = toInt(process.env.SYNC_QUEUE_RETRY_VOLUME, 40);
const MAX_FLUSH_MS = toInt(process.env.SYNC_QUEUE_LOAD_MAX_MS, 8000);

const makeRecord = (date: string, marker: string): DailyRecord =>
  ({
    date,
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: marker,
    nurses: [],
    activeExtraBeds: [],
  }) as DailyRecord;

describe('syncQueueService load baseline', () => {
  beforeEach(async () => {
    await hospitalDB.syncQueue.clear();
    vi.clearAllMocks();
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
  });

  it('handles volume of 120 queued records and flushes all', async () => {
    const total = LOAD_VOLUME;
    for (let i = 0; i < total; i++) {
      const date = `2026-03-${String((i % 28) + 1).padStart(2, '0')}-${i}`;
      await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord(date, `v${i}`));
    }

    const t0 = Date.now();
    await processSyncQueue();
    const elapsedMs = Date.now() - t0;

    const telemetry = await getSyncQueueTelemetry();
    expect(telemetry.pending).toBe(0);
    expect(telemetry.failed).toBe(0);
    expect(telemetry.conflict).toBe(0);
    expect(vi.mocked(db.setDoc)).toHaveBeenCalledTimes(total);
    expect(elapsedMs).toBeLessThan(MAX_FLUSH_MS);
  });

  it('supports retry burst and eventual drain after nextAttemptAt is reached', async () => {
    const total = RETRY_VOLUME;
    let callCount = 0;
    vi.mocked(db.setDoc).mockImplementation(async () => {
      callCount += 1;
      if (callCount <= 10) {
        throw new Error('Network temporary failure');
      }
    });

    for (let i = 0; i < total; i++) {
      const date = `2026-04-${String((i % 28) + 1).padStart(2, '0')}-${i}`;
      await queueSyncTask('UPDATE_DAILY_RECORD', makeRecord(date, `r${i}`));
    }

    await processSyncQueue();
    let telemetry = await getSyncQueueTelemetry();
    expect(telemetry.pending).toBeGreaterThan(0);
    expect(telemetry.retrying).toBeGreaterThan(0);

    await hospitalDB.syncQueue
      .where('status')
      .equals('PENDING')
      .modify(task => {
        task.nextAttemptAt = 0;
      });

    await processSyncQueue();
    telemetry = await getSyncQueueTelemetry();
    expect(telemetry.pending).toBe(0);
    expect(telemetry.failed).toBe(0);
    expect(telemetry.conflict).toBe(0);
  });
});
