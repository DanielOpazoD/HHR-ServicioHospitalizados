/**
 * Sync Queue Service (Outbox Pattern)
 *
 * Manages a queue of pending mutations to be synced with Firestore when online.
 * This ensures data consistency even if the user closes the app while offline
 * or if a write fails due to network instability.
 */

import { db } from '../infrastructure/db';
import { hospitalDB as indexedDB } from './indexedDBService';
import { ensureDbReady } from './indexeddb/indexedDbCore';
import { SyncTask } from './syncQueueTypes';
import { DailyRecord } from '@/types';
import { getDailyRecordsPath } from '@/constants/firestorePaths';
import { isRetryableError, logError } from '@/services/utils/errorService';

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
let isProcessing = false;

const NON_RETRYABLE_FIRESTORE_CODES = [
  'permission-denied',
  'unauthenticated',
  'invalid-argument',
  'failed-precondition',
] as const;

const computeBackoffMs = (attempt: number): number => {
  const jitter = Math.random() * 500;
  const delay = Math.min(BASE_RETRY_DELAY_MS * Math.pow(2, attempt - 1), MAX_RETRY_DELAY_MS);
  return delay + jitter;
};

const getTaskKey = (type: SyncTask['type'], payload: unknown): string | undefined => {
  if (type === 'UPDATE_DAILY_RECORD') {
    const record = payload as DailyRecord;
    return record?.date ? `daily:${record.date}` : undefined;
  }
  return undefined;
};

const getErrorCode = (error: unknown): string => {
  const value = (error as { code?: string })?.code || '';
  return String(value).toLowerCase();
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) return error.message.toLowerCase();
  return String(error).toLowerCase();
};

export const isConflictSyncError = (error: unknown): boolean => {
  const name = (error as { name?: string })?.name;
  if (name === 'ConcurrencyError') return true;

  const message = getErrorMessage(error);
  return (
    message.includes('concurrency conflict') || message.includes('modificado por otro usuario')
  );
};

export const isRetryableSyncError = (error: unknown): boolean => {
  const code = getErrorCode(error);
  if (NON_RETRYABLE_FIRESTORE_CODES.some(nonRetryableCode => code.includes(nonRetryableCode))) {
    return false;
  }

  if (isRetryableError(error)) {
    return true;
  }

  const message = getErrorMessage(error);
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed to fetch') ||
    message.includes('offline')
  );
};

export const getSyncQueueStats = async (): Promise<{
  pending: number;
  failed: number;
  conflict: number;
}> => {
  try {
    const telemetry = await getSyncQueueTelemetry();
    return {
      pending: telemetry.pending,
      failed: telemetry.failed,
      conflict: telemetry.conflict,
    };
  } catch (error) {
    console.warn('[SyncQueue] Failed to read queue stats:', error);
    return { pending: 0, failed: 0, conflict: 0 };
  }
};

export interface SyncQueueTelemetry {
  pending: number;
  failed: number;
  conflict: number;
  retrying: number;
  oldestPendingAgeMs: number;
}

export const getSyncQueueTelemetry = async (): Promise<SyncQueueTelemetry> => {
  try {
    await ensureDbReady();
    const now = Date.now();
    const rows = await indexedDB.syncQueue.toArray();
    const pendingRows = rows.filter(row => row.status === 'PENDING');

    const pending = pendingRows.length;
    const failed = rows.filter(row => row.status === 'FAILED').length;
    const conflict = rows.filter(row => row.status === 'CONFLICT').length;
    const retrying = pendingRows.filter(row => row.retryCount > 0).length;
    const oldestTimestamp = pendingRows.reduce<number>(
      (acc, row) => (row.timestamp < acc ? row.timestamp : acc),
      Number.POSITIVE_INFINITY
    );
    const oldestPendingAgeMs =
      Number.isFinite(oldestTimestamp) && oldestTimestamp > 0
        ? Math.max(0, now - oldestTimestamp)
        : 0;

    return { pending, failed, conflict, retrying, oldestPendingAgeMs };
  } catch (error) {
    console.warn('[SyncQueue] Failed to read queue telemetry:', error);
    return { pending: 0, failed: 0, conflict: 0, retrying: 0, oldestPendingAgeMs: 0 };
  }
};

/**
 * Adds a task to the sync queue.
 */
export const queueSyncTask = async (type: SyncTask['type'], payload: unknown): Promise<void> => {
  try {
    await ensureDbReady();
    const key = getTaskKey(type, payload);
    const now = Date.now();

    if (key) {
      const existing = await indexedDB.syncQueue.where('type').equals(type).toArray();

      const match = existing.find(task => task.key === key && task.status !== 'FAILED');

      if (match?.id) {
        await indexedDB.syncQueue.update(match.id, {
          payload,
          timestamp: now,
          status: 'PENDING',
          nextAttemptAt: 0,
          error: undefined,
        });
        if (typeof navigator !== 'undefined' && navigator.onLine) {
          void processSyncQueue();
        }
        return;
      }
    }

    await indexedDB.syncQueue.add({
      opId: `${type}:${key ?? 'global'}:${now}`,
      type,
      payload,
      timestamp: now,
      retryCount: 0,
      status: 'PENDING',
      nextAttemptAt: 0,
      key,
    });

    // Trigger processing immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void processSyncQueue();
    }
  } catch (error) {
    console.error('[SyncQueue] Failed to queue task:', error);
  }
};

/**
 * Processes pending tasks in the queue.
 */
export const processSyncQueue = async (): Promise<void> => {
  if (isProcessing) return;
  isProcessing = true;

  try {
    await ensureDbReady();

    const now = Date.now();
    const tasks = await indexedDB.syncQueue.where('status').equals('PENDING').sortBy('timestamp');

    const readyTasks = tasks.filter(task => (task.nextAttemptAt || 0) <= now);
    if (readyTasks.length === 0) {
      return;
    }

    console.warn(`[SyncQueue] Processing ${readyTasks.length} pending tasks...`);

    for (const task of readyTasks) {
      if (!task.id) continue;

      try {
        // Mark as processing
        await indexedDB.syncQueue.update(task.id, { status: 'PROCESSING' });

        // Execute task based on type
        switch (task.type) {
          case 'UPDATE_DAILY_RECORD':
            await syncDailyRecord(task.payload as DailyRecord);
            break;
          // Add other cases here
        }

        // Task successful - remove from queue
        await indexedDB.syncQueue.delete(task.id);
        console.warn(`[SyncQueue] Task ${task.id} completed successfully.`);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(`[SyncQueue] Task ${task.id} failed:`, error);

        if (isConflictSyncError(error)) {
          await indexedDB.syncQueue.update(task.id, {
            status: 'CONFLICT',
            error: errorMessage,
          });
          continue;
        }

        if (!isRetryableSyncError(error)) {
          await indexedDB.syncQueue.update(task.id, {
            status: 'FAILED',
            error: errorMessage,
          });
          continue;
        }

        const newRetryCount = task.retryCount + 1;

        if (newRetryCount >= MAX_RETRIES) {
          // Max retries reached - mark as failed (dead letter)
          await indexedDB.syncQueue.update(task.id, {
            status: 'FAILED',
            error: errorMessage,
            retryCount: newRetryCount,
          });
          logError('Sync task permanently failed', error instanceof Error ? error : undefined, {
            taskId: task.id,
            type: task.type,
            key: task.key,
            retryCount: newRetryCount,
          });
        } else {
          const delay = computeBackoffMs(newRetryCount);
          await indexedDB.syncQueue.update(task.id, {
            status: 'PENDING',
            retryCount: newRetryCount,
            error: errorMessage,
            nextAttemptAt: Date.now() + delay,
          });
        }
      }
    }
  } finally {
    isProcessing = false;
  }
};

/**
 * Executes the Firestore write for a DailyRecord.
 */
async function syncDailyRecord(record: DailyRecord): Promise<void> {
  const path = getDailyRecordsPath();
  await db.setDoc(path, record.date, record, { merge: true });
}

// Auto-start processing when coming online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.warn('[SyncQueue] Online detected, flushing queue...');
    processSyncQueue();
  });
}
