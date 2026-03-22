import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncQueueTelemetry } from '@/services/storage/sync/syncQueueTelemetryContracts';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';
import {
  resolveSyncQueueBudgetState,
  resolveSyncQueueRuntimeState,
  SYNC_QUEUE_RUNTIME_THRESHOLDS,
} from '@/services/storage/sync/syncQueueOperationalBudgets';

export interface SyncQueueTelemetrySnapshot extends SyncQueueTelemetry {
  capturedAt: number;
}

export const buildSyncQueueTelemetryFromRows = (
  rows: SyncTask[],
  now: number,
  batchSize: number
): SyncQueueTelemetry => {
  const pendingRows = rows.filter(row => row.status === 'PENDING');
  const oldestTimestamp = pendingRows.reduce<number>(
    (acc, row) => (row.timestamp < acc ? row.timestamp : acc),
    Number.POSITIVE_INFINITY
  );
  const oldestPendingAgeMs =
    Number.isFinite(oldestTimestamp) && oldestTimestamp > 0
      ? Math.max(0, now - oldestTimestamp)
      : 0;
  const retrying = pendingRows.filter(row => row.retryCount > 0).length;
  const oldestPendingBudgetState = resolveSyncQueueBudgetState(
    oldestPendingAgeMs,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.warningOldestPendingAgeMs,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.criticalOldestPendingAgeMs
  );
  const retryingBudgetState = resolveSyncQueueBudgetState(
    retrying,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.warningRetryingSyncTasks,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.criticalRetryingSyncTasks
  );

  return {
    pending: pendingRows.length,
    failed: rows.filter(row => row.status === 'FAILED').length,
    conflict: rows.filter(row => row.status === 'CONFLICT').length,
    retrying,
    oldestPendingAgeMs,
    batchSize,
    oldestPendingBudgetState,
    retryingBudgetState,
    runtimeState: resolveSyncQueueRuntimeState(oldestPendingAgeMs, retrying),
  };
};

export const buildSyncQueueTelemetrySnapshot = (
  rows: SyncTask[],
  now: number,
  batchSize: number
): SyncQueueTelemetrySnapshot => ({
  ...buildSyncQueueTelemetryFromRows(rows, now, batchSize),
  capturedAt: now,
});

export const recordSyncQueueFailureTelemetry = (
  task: Pick<SyncTask, 'id' | 'type' | 'key' | 'contexts'>,
  errorMessage: string,
  status: 'failed' | 'degraded',
  context?: Record<string, unknown>
): void => {
  const runtimeState = status === 'failed' ? 'blocked' : 'retryable';
  recordOperationalTelemetry({
    category: 'sync',
    status,
    runtimeState,
    operation: 'sync_queue_task_failure',
    issues: [errorMessage],
    context: {
      taskId: task.id,
      type: task.type,
      key: task.key,
      contexts: task.contexts,
      ...context,
    },
  });
};

export const recordSyncQueueConflictTelemetry = (
  task: Pick<SyncTask, 'id' | 'type' | 'key' | 'contexts'>,
  errorMessage: string
): void => {
  recordOperationalTelemetry({
    category: 'sync',
    status: 'degraded',
    runtimeState: 'blocked',
    operation: 'sync_queue_task_conflict',
    issues: [errorMessage],
    context: {
      taskId: task.id,
      type: task.type,
      key: task.key,
      contexts: task.contexts,
    },
  });
};

export const recordSyncQueueDecisionTelemetry = (
  task: Pick<SyncTask, 'id' | 'type' | 'key' | 'contexts'>,
  errorMessage: string,
  status: 'failed' | 'degraded' | 'conflict',
  context?: Record<string, unknown>
): void => {
  if (status === 'conflict') {
    recordSyncQueueConflictTelemetry(task, errorMessage);
    return;
  }

  recordSyncQueueFailureTelemetry(task, errorMessage, status, context);
};

export const recordSyncQueueBudgetTelemetry = (
  telemetry: SyncQueueTelemetry,
  context: Record<string, unknown> = {}
): void => {
  if (telemetry.runtimeState === 'ok') {
    return;
  }

  recordOperationalTelemetry({
    category: 'sync',
    operation: 'sync_queue_budget_threshold',
    status: telemetry.runtimeState === 'blocked' ? 'failed' : 'degraded',
    runtimeState: telemetry.runtimeState === 'blocked' ? 'blocked' : 'degraded',
    issues: ['La cola de sincronizacion excedio sus budgets operativos.'],
    context: {
      pending: telemetry.pending,
      retrying: telemetry.retrying,
      failed: telemetry.failed,
      conflict: telemetry.conflict,
      oldestPendingAgeMs: telemetry.oldestPendingAgeMs,
      oldestPendingBudgetState: telemetry.oldestPendingBudgetState,
      retryingBudgetState: telemetry.retryingBudgetState,
      ...context,
    },
  });
};
