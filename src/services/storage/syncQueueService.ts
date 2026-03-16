/**
 * Sync Queue Service (Outbox Pattern)
 *
 * Public facade over the sync engine. The queue runtime, persistent store and
 * remote transport are now isolated behind ports so offline-first behavior can
 * evolve without hard-wiring Dexie, browser events and Firestore in one file.
 *
 * @deprecated New product code should import from `@/services/storage/sync`.
 */

import { ensureDbReady } from './indexeddb/indexedDbCore';
import type { SyncTask } from './syncQueueTypes';
import { createBrowserSyncRuntime } from './sync/browserSyncRuntime';
import { createDexieSyncQueueStore } from './sync/dexieSyncQueueStore';
import { createFirestoreSyncTransport } from './sync/firestoreSyncTransport';
import {
  createSyncQueueEngine,
  type SyncQueueDomainMetrics,
  type SyncQueueOperationSnapshot,
  type SyncQueueTelemetry,
} from './sync/syncQueueEngine';
import { classifySyncError } from './syncErrorCatalog';
import { logger } from '@/services/utils/loggerService';

const MAX_RETRIES = 5;
const SYNC_QUEUE_BATCH_SIZE = 25;
const BASE_RETRY_DELAY_MS = 1000;
const MAX_RETRY_DELAY_MS = 30000;
const syncQueueLogger = logger.child('SyncQueue');

const syncQueueEngine = createSyncQueueEngine({
  store: createDexieSyncQueueStore(),
  runtime: createBrowserSyncRuntime(),
  transport: createFirestoreSyncTransport(),
  batchSize: SYNC_QUEUE_BATCH_SIZE,
  maxRetries: MAX_RETRIES,
  baseRetryDelayMs: BASE_RETRY_DELAY_MS,
  maxRetryDelayMs: MAX_RETRY_DELAY_MS,
});

export const isConflictSyncError = (error: unknown): boolean =>
  classifySyncError(error).category === 'conflict';

export const isRetryableSyncError = (error: unknown): boolean => classifySyncError(error).retryable;

export const getSyncQueueStats = async (): Promise<{
  pending: number;
  failed: number;
  conflict: number;
}> => {
  try {
    await ensureDbReady();
    return await syncQueueEngine.getStats();
  } catch (error) {
    syncQueueLogger.warn('Failed to read queue stats', error);
    return { pending: 0, failed: 0, conflict: 0 };
  }
};

export const getSyncQueueTelemetry = async (): Promise<SyncQueueTelemetry> => {
  try {
    await ensureDbReady();
    return await syncQueueEngine.getTelemetry();
  } catch (error) {
    syncQueueLogger.warn('Failed to read queue telemetry', error);
    return {
      pending: 0,
      failed: 0,
      conflict: 0,
      retrying: 0,
      oldestPendingAgeMs: 0,
      batchSize: SYNC_QUEUE_BATCH_SIZE,
    };
  }
};

export const listRecentSyncQueueOperations = async (
  limit: number
): Promise<SyncQueueOperationSnapshot[]> => {
  try {
    await ensureDbReady();
    return await syncQueueEngine.listRecentOperations(limit);
  } catch (error) {
    syncQueueLogger.warn('Failed to list recent operations', error);
    return [];
  }
};

export const getSyncQueueDomainMetrics = async (): Promise<SyncQueueDomainMetrics> => {
  try {
    await ensureDbReady();
    return await syncQueueEngine.getDomainMetrics();
  } catch (error) {
    syncQueueLogger.warn('Failed to read domain metrics', error);
    return {
      byContext: {
        clinical: { pending: 0, failed: 0, conflict: 0, retrying: 0 },
        staffing: { pending: 0, failed: 0, conflict: 0, retrying: 0 },
        movements: { pending: 0, failed: 0, conflict: 0, retrying: 0 },
        handoff: { pending: 0, failed: 0, conflict: 0, retrying: 0 },
        metadata: { pending: 0, failed: 0, conflict: 0, retrying: 0 },
        unknown: { pending: 0, failed: 0, conflict: 0, retrying: 0 },
      },
      byOrigin: {},
      byRecoveryPolicy: {},
    };
  }
};

export const queueSyncTask = async (
  type: SyncTask['type'],
  payload: unknown,
  meta?: Pick<SyncTask, 'contexts' | 'origin' | 'recoveryPolicy'>
): Promise<void> => {
  try {
    await ensureDbReady();
    await syncQueueEngine.queueTask(type, payload, meta);
  } catch (error) {
    syncQueueLogger.error('Failed to queue task', error);
  }
};

export const processSyncQueue = async (): Promise<void> => {
  await ensureDbReady();
  await syncQueueEngine.processQueue();
};

export const ensureSyncQueueOnlineListener = (): void => {
  syncQueueEngine.ensureOnlineListener();
};

ensureSyncQueueOnlineListener();

export type { SyncQueueDomainMetrics, SyncQueueOperationSnapshot, SyncQueueTelemetry };
