import { ensureDbReady } from '@/services/storage/indexeddb/indexedDbCore';
import type { SyncTask } from '@/services/storage/syncQueueTypes';
import { createBrowserSyncRuntime } from '@/services/storage/sync/browserSyncRuntime';
import { createDexieSyncQueueStore } from '@/services/storage/sync/dexieSyncQueueStore';
import { createFirestoreSyncTransport } from '@/services/storage/sync/firestoreSyncTransport';
import {
  createSyncQueueEngine,
  type SyncQueueDomainMetrics,
  type SyncQueueOperationSnapshot,
  type SyncQueueTelemetry,
} from '@/services/storage/sync/syncQueueEngine';
import { classifySyncError } from '@/services/storage/syncErrorCatalog';
import { createDomainObservability } from '@/services/observability/domainObservability';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';
import {
  BASE_RETRY_DELAY_MS,
  MAX_RETRIES,
  MAX_RETRY_DELAY_MS,
  SYNC_QUEUE_BATCH_SIZE,
} from '@/services/storage/sync/syncQueueOperationalBudgets';
import { recordSyncQueueBudgetTelemetry } from '@/services/storage/sync/syncQueueTelemetryController';

const syncObservability = createDomainObservability('sync', 'SyncQueue');

const toSyncIssueMessage = (error: unknown, fallback: string): string =>
  error instanceof Error && error.message.trim().length > 0 ? error.message : fallback;

const recordSyncRuntimeReadFailure = (
  operation: string,
  error: unknown,
  context: Record<string, unknown> = {}
): void => {
  recordOperationalTelemetry({
    category: 'sync',
    operation,
    status: 'failed',
    runtimeState: 'blocked',
    issues: [toSyncIssueMessage(error, 'La cola de sincronizacion no pudo leerse.')],
    context,
  });
};

const buildUnavailableSyncQueueTelemetry = (error: unknown): SyncQueueTelemetry => ({
  pending: 0,
  failed: 0,
  conflict: 0,
  retrying: 0,
  oldestPendingAgeMs: 0,
  batchSize: SYNC_QUEUE_BATCH_SIZE,
  oldestPendingBudgetState: 'ok',
  retryingBudgetState: 'ok',
  runtimeState: 'blocked',
  readState: 'unavailable',
  issues: [toSyncIssueMessage(error, 'La cola de sincronizacion no pudo leerse.')],
});

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
    syncObservability.logger.warn('Failed to read queue stats', error);
    recordSyncRuntimeReadFailure('sync_queue_stats_unavailable', error, {
      source: 'public_sync_queue',
    });
    return { pending: 0, failed: 0, conflict: 0 };
  }
};

export const getSyncQueueTelemetry = async (): Promise<SyncQueueTelemetry> => {
  try {
    await ensureDbReady();
    const telemetry = await syncQueueEngine.getTelemetry();
    recordSyncQueueBudgetTelemetry(telemetry, {
      source: 'public_sync_queue',
      batchSize: SYNC_QUEUE_BATCH_SIZE,
      maxRetries: MAX_RETRIES,
    });
    return {
      ...telemetry,
      readState: 'ok',
    };
  } catch (error) {
    syncObservability.logger.warn('Failed to read queue telemetry', error);
    recordSyncRuntimeReadFailure('sync_queue_telemetry_unavailable', error, {
      source: 'public_sync_queue',
      batchSize: SYNC_QUEUE_BATCH_SIZE,
      maxRetries: MAX_RETRIES,
    });
    return buildUnavailableSyncQueueTelemetry(error);
  }
};

export const listRecentSyncQueueOperations = async (
  limit: number
): Promise<SyncQueueOperationSnapshot[]> => {
  try {
    await ensureDbReady();
    return await syncQueueEngine.listRecentOperations(limit);
  } catch (error) {
    syncObservability.logger.warn('Failed to list recent operations', error);
    recordSyncRuntimeReadFailure('sync_queue_recent_operations_unavailable', error, {
      source: 'public_sync_queue',
      limit,
    });
    return [];
  }
};

export const getSyncQueueDomainMetrics = async (): Promise<SyncQueueDomainMetrics> => {
  try {
    await ensureDbReady();
    return await syncQueueEngine.getDomainMetrics();
  } catch (error) {
    syncObservability.logger.warn('Failed to read domain metrics', error);
    recordSyncRuntimeReadFailure('sync_queue_domain_metrics_unavailable', error, {
      source: 'public_sync_queue',
    });
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
    syncObservability.logger.error('Failed to queue task', error);
    recordOperationalTelemetry({
      category: 'sync',
      operation: 'sync_queue_enqueue_failure',
      status: 'failed',
      runtimeState: 'blocked',
      issues: [toSyncIssueMessage(error, 'La cola de sincronizacion no pudo recibir la tarea.')],
      context: {
        type,
        contexts: meta?.contexts,
        origin: meta?.origin,
        recoveryPolicy: meta?.recoveryPolicy,
      },
    });
  }
};

export const processSyncQueue = async (): Promise<void> => {
  try {
    await ensureDbReady();
    await syncQueueEngine.processQueue();
  } catch (error) {
    syncObservability.logger.error('Failed to process queue', error);
    recordOperationalTelemetry({
      category: 'sync',
      operation: 'sync_queue_process_failure',
      status: 'failed',
      runtimeState: 'blocked',
      issues: [toSyncIssueMessage(error, 'La cola de sincronizacion no pudo procesarse.')],
      context: {
        source: 'public_sync_queue',
      },
    });
  }
};

export const ensureSyncQueueOnlineListener = (): void => {
  syncQueueEngine.ensureOnlineListener();
};

ensureSyncQueueOnlineListener();

export type { SyncQueueDomainMetrics, SyncQueueOperationSnapshot, SyncQueueTelemetry };
