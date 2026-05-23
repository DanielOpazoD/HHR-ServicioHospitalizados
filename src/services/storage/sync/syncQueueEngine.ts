import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
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
import { buildSyncTaskContract } from '@/services/storage/sync/syncTaskContractPolicy';

export interface SyncQueueOperationSnapshot {
  id?: number;
  type: SyncTask['type'];
  status: SyncTask['status'];
  retryCount: number;
  timestamp: number;
  nextAttemptAt?: number;
  error?: string;
  lastErrorCode?: SyncTask['lastErrorCode'];
  lastErrorCategory?: SyncTask['lastErrorCategory'];
  lastErrorSeverity?: SyncTask['lastErrorSeverity'];
  lastErrorAction?: SyncTask['lastErrorAction'];
  lastErrorAt?: SyncTask['lastErrorAt'];
  key?: string;
  contexts?: SyncTask['contexts'];
  origin?: SyncTask['origin'];
  recoveryPolicy?: SyncTask['recoveryPolicy'];
  syncContract?: SyncTask['syncContract'];
}

interface CreateSyncQueueEngineOptions {
  store: SyncQueueStorePort;
  runtime: SyncRuntimePort;
  transport: SyncTransportPort;
  batchSize: number;
  maxPendingTasks: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
}

export interface SyncQueueEnqueueResult {
  accepted: boolean;
  mode: 'created' | 'reused' | 'rejected_backpressure' | 'enqueue_failed';
  pendingTasks: number;
  maxPendingTasks: number;
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

const sanitizeSyncContractForOperationalSnapshot = (
  syncContract: SyncTask['syncContract']
): SyncTask['syncContract'] | undefined => {
  if (!syncContract) return undefined;
  return {
    expectedVersion: syncContract.expectedVersion,
    recordRevision: syncContract.recordRevision,
    changedPaths: syncContract.changedPaths,
    mutationId: syncContract.mutationId,
    clientId: syncContract.clientId,
    tabId: syncContract.tabId,
  };
};

export const createSyncQueueEngine = ({
  store,
  runtime,
  transport,
  batchSize,
  maxPendingTasks,
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
    meta?: Pick<SyncTask, 'contexts' | 'origin' | 'recoveryPolicy' | 'syncContract'>
  ): Promise<SyncQueueEnqueueResult> => {
    const key = getTaskKey(type, payload);
    const ownerKey = runtime.getOwnerKey();
    const taskOwnerKey = ownerKey ?? undefined;
    const now = Date.now();
    const contextMeta = buildSyncQueueTaskContextMeta({
      contexts: meta?.contexts,
      recoveryPolicy: meta?.recoveryPolicy,
    });
    const syncContract = buildSyncTaskContract(type, payload, meta?.syncContract);

    if (key) {
      const existing = await store.findReusableTask(type, key, ownerKey);
      if (existing?.id) {
        await store.update(existing.id, {
          payload,
          timestamp: now,
          retryCount: 0,
          key,
          ownerKey: taskOwnerKey,
          contexts: contextMeta.contexts,
          origin: meta?.origin || existing.origin || 'direct_queue',
          recoveryPolicy: contextMeta.recoveryPolicy,
          syncContract,
          ...clearTaskErrorState(),
        });
        triggerProcessing();
        const pendingTasks = (await store.listAll(ownerKey)).filter(
          task => task.status === 'PENDING' || task.status === 'PROCESSING'
        ).length;
        return {
          accepted: true,
          mode: 'reused',
          pendingTasks,
          maxPendingTasks,
        };
      }
    }

    const pendingTasks = (await store.listAll(ownerKey)).filter(
      task => task.status === 'PENDING' || task.status === 'PROCESSING'
    ).length;
    if (pendingTasks >= maxPendingTasks) {
      return {
        accepted: false,
        mode: 'rejected_backpressure',
        pendingTasks,
        maxPendingTasks,
      };
    }

    await store.add({
      opId: `${type}:${key ?? 'global'}:${now}`,
      type,
      payload,
      timestamp: now,
      retryCount: 0,
      key,
      ownerKey: taskOwnerKey,
      contexts: contextMeta.contexts,
      origin: meta?.origin || 'direct_queue',
      recoveryPolicy: contextMeta.recoveryPolicy,
      syncContract,
      ...clearTaskErrorState(),
    });
    triggerProcessing();
    return {
      accepted: true,
      mode: 'created',
      pendingTasks: pendingTasks + 1,
      maxPendingTasks,
    };
  };

  const getTelemetry = async (): Promise<SyncQueueTelemetry> => {
    const ownerKey = runtime.getOwnerKey();
    const rows = await store.listAll(ownerKey);
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
    const rows = await store.listRecent(limit, runtime.getOwnerKey());
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      status: row.status,
      retryCount: row.retryCount,
      timestamp: row.timestamp,
      nextAttemptAt: row.nextAttemptAt,
      error: row.error,
      lastErrorCode: row.lastErrorCode,
      lastErrorCategory: row.lastErrorCategory,
      lastErrorSeverity: row.lastErrorSeverity,
      lastErrorAction: row.lastErrorAction,
      lastErrorAt: row.lastErrorAt,
      key: row.key,
      contexts: row.contexts,
      origin: row.origin,
      recoveryPolicy: row.recoveryPolicy,
      syncContract: sanitizeSyncContractForOperationalSnapshot(row.syncContract),
    }));
  };

  const getDomainMetrics = async (): Promise<SyncQueueDomainMetrics> => {
    const rows = await store.listAll(runtime.getOwnerKey());
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
            const readyTasks = await store.listReadyPending(
              Date.now(),
              batchSize,
              runtime.getOwnerKey()
            );
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
