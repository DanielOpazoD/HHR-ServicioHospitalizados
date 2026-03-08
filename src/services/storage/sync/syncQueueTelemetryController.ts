import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncQueueTelemetry } from '@/services/storage/sync/syncQueueEngine';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';

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

  return {
    pending: pendingRows.length,
    failed: rows.filter(row => row.status === 'FAILED').length,
    conflict: rows.filter(row => row.status === 'CONFLICT').length,
    retrying: pendingRows.filter(row => row.retryCount > 0).length,
    oldestPendingAgeMs:
      Number.isFinite(oldestTimestamp) && oldestTimestamp > 0
        ? Math.max(0, now - oldestTimestamp)
        : 0,
    batchSize,
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
  recordOperationalTelemetry({
    category: 'sync',
    status,
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
