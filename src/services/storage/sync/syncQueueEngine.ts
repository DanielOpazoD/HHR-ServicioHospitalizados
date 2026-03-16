import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { ErrorSeverity } from '@/services/logging/errorLogTypes';
import { logError } from '@/services/utils/errorService';
import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncErrorCategory } from '@/services/storage/syncErrorCatalog';
import type {
  SyncQueueStorePort,
  SyncRuntimePort,
  SyncTransportPort,
} from '@/services/storage/sync/syncQueuePorts';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import {
  buildSyncQueueDomainMetrics,
  type SyncQueueDomainMetrics,
} from '@/services/storage/sync/syncDomainPolicy';
import type { SyncQueueTelemetry } from '@/services/storage/sync/syncQueueTelemetryContracts';
import {
  resolveSyncQueueFailureDecision,
  buildSyncQueueTaskContextMeta,
} from '@/services/storage/sync/syncQueueFailurePolicy';
import {
  buildSyncQueueTelemetryFromRows,
  recordSyncQueueDecisionTelemetry,
} from '@/services/storage/sync/syncQueueTelemetryController';

export interface SyncQueueOperationSnapshot {
  id?: number;
  type: SyncTask['type'];
  status: SyncTask['status'];
  retryCount: number;
  timestamp: number;
  nextAttemptAt?: number;
  error?: string;
  key?: string;
  contexts?: SyncTask['contexts'];
  origin?: SyncTask['origin'];
  recoveryPolicy?: SyncTask['recoveryPolicy'];
}

interface CreateSyncQueueEngineOptions {
  store: SyncQueueStorePort;
  runtime: SyncRuntimePort;
  transport: SyncTransportPort;
  batchSize: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
}

const clearTaskErrorState = () => ({
  status: 'PENDING' as const,
  nextAttemptAt: 0,
  error: undefined,
  lastErrorCode: undefined,
  lastErrorCategory: undefined,
  lastErrorSeverity: undefined,
  lastErrorAction: undefined,
  lastErrorAt: undefined,
});

const getTaskKey = (type: SyncTask['type'], payload: unknown): string | undefined => {
  if (type === 'UPDATE_DAILY_RECORD') {
    const record = payload as DailyRecord;
    return record?.date ? `daily:${record.date}` : undefined;
  }

  return undefined;
};

export const createSyncQueueEngine = ({
  store,
  runtime,
  transport,
  batchSize,
  maxRetries,
  baseRetryDelayMs,
  maxRetryDelayMs,
}: CreateSyncQueueEngineOptions) => {
  let isProcessing = false;

  const triggerProcessing = (): void => {
    if (!runtime.isOnline()) return;
    void processQueue();
  };

  const updateTaskState = async (
    taskId: number,
    patch: Partial<SyncTask> & { status: SyncTask['status'] }
  ): Promise<void> => {
    await store.update(taskId, patch);
  };

  const handleTaskFailure = async (task: SyncTask, error: unknown): Promise<void> => {
    if (!task.id) {
      return;
    }

    const decision = resolveSyncQueueFailureDecision({
      task,
      error,
      maxRetries,
      baseRetryDelayMs,
      maxRetryDelayMs,
    });

    await updateTaskState(task.id, {
      status: decision.status,
      retryCount: decision.retryCount,
      nextAttemptAt: decision.nextAttemptAt,
      contexts: decision.contexts,
      recoveryPolicy: decision.recoveryPolicy,
      error: decision.error,
      lastErrorCode: decision.lastErrorCode,
      lastErrorCategory: decision.lastErrorCategory as SyncErrorCategory | undefined,
      lastErrorSeverity: decision.lastErrorSeverity as ErrorSeverity | undefined,
      lastErrorAction: decision.lastErrorAction,
      lastErrorAt: decision.lastErrorAt,
    });

    if (decision.shouldLogPermanentFailure) {
      logError('Sync task permanently failed', error instanceof Error ? error : undefined, {
        taskId: task.id,
        type: task.type,
        key: task.key,
        retryCount: decision.retryCount,
        contexts: decision.contexts,
        recoveryPolicy: decision.recoveryPolicy,
      });
    }

    recordSyncQueueDecisionTelemetry(
      task,
      decision.error,
      decision.status === 'CONFLICT'
        ? 'conflict'
        : decision.status === 'FAILED'
          ? 'failed'
          : 'degraded',
      decision.status === 'CONFLICT' ? undefined : { retryCount: decision.retryCount }
    );
  };

  const queueTask = async (
    type: SyncTask['type'],
    payload: unknown,
    meta?: Pick<SyncTask, 'contexts' | 'origin' | 'recoveryPolicy'>
  ): Promise<void> => {
    const key = getTaskKey(type, payload);
    const now = Date.now();
    const contextMeta = buildSyncQueueTaskContextMeta({
      contexts: meta?.contexts,
      recoveryPolicy: meta?.recoveryPolicy,
    });

    if (key) {
      const existing = await store.findReusableTask(type, key);
      if (existing?.id) {
        await store.update(existing.id, {
          payload,
          timestamp: now,
          retryCount: 0,
          key,
          contexts: contextMeta.contexts,
          origin: meta?.origin || existing.origin || 'direct_queue',
          recoveryPolicy: contextMeta.recoveryPolicy,
          ...clearTaskErrorState(),
        });
        triggerProcessing();
        return;
      }
    }

    await store.add({
      opId: `${type}:${key ?? 'global'}:${now}`,
      type,
      payload,
      timestamp: now,
      retryCount: 0,
      key,
      contexts: contextMeta.contexts,
      origin: meta?.origin || 'direct_queue',
      recoveryPolicy: contextMeta.recoveryPolicy,
      ...clearTaskErrorState(),
    });
    triggerProcessing();
  };

  const getTelemetry = async (): Promise<SyncQueueTelemetry> => {
    const rows = await store.listAll();
    return buildSyncQueueTelemetryFromRows(rows, Date.now(), batchSize);
  };

  const getStats = async (): Promise<{ pending: number; failed: number; conflict: number }> => {
    const telemetry = await getTelemetry();
    return {
      pending: telemetry.pending,
      failed: telemetry.failed,
      conflict: telemetry.conflict,
    };
  };

  const listRecentOperations = async (limit: number): Promise<SyncQueueOperationSnapshot[]> => {
    const rows = await store.listRecent(limit);
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      status: row.status,
      retryCount: row.retryCount,
      timestamp: row.timestamp,
      nextAttemptAt: row.nextAttemptAt,
      error: row.error,
      key: row.key,
      contexts: row.contexts,
      origin: row.origin,
      recoveryPolicy: row.recoveryPolicy,
    }));
  };

  const getDomainMetrics = async (): Promise<SyncQueueDomainMetrics> => {
    const rows = await store.listAll();
    return buildSyncQueueDomainMetrics(rows);
  };

  const processQueue = async (): Promise<void> => {
    if (isProcessing) return;
    isProcessing = true;

    try {
      await measureRepositoryOperation(
        'syncQueue.process',
        async () => {
          while (true) {
            const readyTasks = await store.listReadyPending(Date.now(), batchSize);
            if (readyTasks.length === 0) {
              return;
            }

            for (const task of readyTasks) {
              if (!task.id) continue;

              try {
                await updateTaskState(task.id, { status: 'PROCESSING' });
                await transport.run(task);
                await store.delete(task.id);
              } catch (error) {
                await handleTaskFailure(task, error);
              }
            }

            if (readyTasks.length < batchSize) {
              return;
            }
          }
        },
        { thresholdMs: 250, context: `batch=${batchSize}` }
      );
    } finally {
      isProcessing = false;
    }
  };

  const ensureOnlineListener = (): void => {
    runtime.onOnline(() => {
      triggerProcessing();
    });
  };

  return {
    queueTask,
    processQueue,
    getTelemetry,
    getDomainMetrics,
    getStats,
    listRecentOperations,
    ensureOnlineListener,
  };
};

export type { SyncQueueDomainMetrics } from '@/services/storage/sync/syncDomainPolicy';
export type { SyncQueueTelemetry } from '@/services/storage/sync/syncQueueTelemetryContracts';
