import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import type { ErrorSeverity } from '@/services/logging/errorLogTypes';
import { logError } from '@/services/utils/errorService';
import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncErrorCategory } from '@/services/storage/syncErrorCatalog';
import type {
  SyncQueueLeaseClaim,
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
  recordSyncQueueStaleClaimTelemetry,
} from '@/services/storage/sync/syncQueueTelemetryController';
import { buildSyncTaskContract } from '@/services/storage/sync/syncTaskContractPolicy';
import {
  clearSyncTaskRuntimeState,
  createSyncQueueAttemptId,
  createSyncQueueWorkerId,
  getSyncTaskKey,
} from '@/services/storage/sync/syncQueueTaskFactory';
import {
  toSyncQueueOperationSnapshot,
  type SyncQueueOperationSnapshot,
} from '@/services/storage/sync/syncQueueOperationSnapshot';

const SYNC_QUEUE_LEASE_MS = 30_000;

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
  const workerId = createSyncQueueWorkerId();

  const triggerProcessing = (): void => {
    if (!runtime.isOnline()) return;
    void processQueue();
  };

  const buildTaskClaim = (task: SyncTask): SyncQueueLeaseClaim | null => {
    if (!task.leaseOwner || !task.attemptId || !task.leaseUntil) {
      return null;
    }
    return {
      leaseOwner: task.leaseOwner,
      leaseUntil: task.leaseUntil,
      attemptId: task.attemptId,
    };
  };

  const updateClaimedTaskState = async (
    task: SyncTask,
    patch: Partial<SyncTask> & { status: SyncTask['status'] }
  ): Promise<void> => {
    if (!task.id) return;
    const claim = buildTaskClaim(task);
    if (!claim) return;
    const updated = await store.updateClaimed(task.id, patch, claim);
    if (!updated) {
      recordSyncQueueStaleClaimTelemetry(task, 'update');
    }
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

    await updateClaimedTaskState(task, {
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
      leaseOwner: undefined,
      leaseUntil: undefined,
      attemptId: undefined,
      processingStartedAt: undefined,
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
    const key = getSyncTaskKey(type, payload);
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
          ...clearSyncTaskRuntimeState(),
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
      ...clearSyncTaskRuntimeState(),
    });
    triggerProcessing();
    return {
      accepted: true,
      mode: 'created',
      pendingTasks: pendingTasks + 1,
      maxPendingTasks,
    };
  };

  const queueDailyRecordTaskWithLocalRecord = async (
    record: DailyRecord,
    meta?: Pick<SyncTask, 'contexts' | 'origin' | 'recoveryPolicy' | 'syncContract'>
  ): Promise<SyncQueueEnqueueResult> => {
    const type: SyncTask['type'] = 'UPDATE_DAILY_RECORD';
    const key = getSyncTaskKey(type, record);
    const ownerKey = runtime.getOwnerKey();
    const taskOwnerKey = ownerKey ?? undefined;
    const now = Date.now();
    const contextMeta = buildSyncQueueTaskContextMeta({
      contexts: meta?.contexts,
      recoveryPolicy: meta?.recoveryPolicy,
    });
    const syncContract = buildSyncTaskContract(type, record, meta?.syncContract);
    const existing = key ? await store.findReusableTask(type, key, ownerKey) : null;

    const pendingTasks = (await store.listAll(ownerKey)).filter(
      task => task.status === 'PENDING' || task.status === 'PROCESSING'
    ).length;
    if (!existing && pendingTasks >= maxPendingTasks) {
      return {
        accepted: false,
        mode: 'rejected_backpressure',
        pendingTasks,
        maxPendingTasks,
      };
    }

    const mode = await store.saveDailyRecordWithTask(record, {
      opId: `${type}:${key ?? 'global'}:${now}`,
      type,
      payload: record,
      timestamp: now,
      retryCount: 0,
      key,
      ownerKey: taskOwnerKey,
      contexts: contextMeta.contexts,
      origin: meta?.origin || existing?.origin || 'direct_queue',
      recoveryPolicy: contextMeta.recoveryPolicy,
      syncContract,
      ...clearSyncTaskRuntimeState(),
    });

    triggerProcessing();
    return {
      accepted: true,
      mode,
      pendingTasks: mode === 'created' ? pendingTasks + 1 : pendingTasks,
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
    return rows.map(toSyncQueueOperationSnapshot);
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
            const now = Date.now();
            const readyTasks = await store.claimReadyPending(
              now,
              batchSize,
              runtime.getOwnerKey(),
              {
                leaseOwner: workerId,
                leaseUntil: now + SYNC_QUEUE_LEASE_MS,
                attemptId: createSyncQueueAttemptId(),
              }
            );
            if (readyTasks.length === 0) {
              return;
            }

            for (const task of readyTasks) {
              if (!task.id) continue;

              try {
                await transport.run(task);
                const claim = buildTaskClaim(task);
                if (claim) {
                  const deleted = await store.deleteClaimed(task.id, claim);
                  if (!deleted) {
                    recordSyncQueueStaleClaimTelemetry(task, 'delete');
                  }
                }
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
    queueDailyRecordTaskWithLocalRecord,
    processQueue,
    getTelemetry,
    getDomainMetrics,
    getStats,
    listRecentOperations,
    ensureOnlineListener,
  };
};
