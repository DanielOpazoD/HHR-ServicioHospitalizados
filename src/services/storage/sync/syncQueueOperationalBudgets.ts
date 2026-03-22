export const SYNC_QUEUE_BATCH_SIZE = 25;
export const MAX_RETRIES = 5;
export const BASE_RETRY_DELAY_MS = 1_000;
export const MAX_RETRY_DELAY_MS = 30_000;

export const SYNC_QUEUE_RUNTIME_THRESHOLDS = {
  warningOldestPendingAgeMs: 300_000,
  criticalOldestPendingAgeMs: 900_000,
  warningRetryingSyncTasks: 1,
  criticalRetryingSyncTasks: 3,
} as const;

export type SyncQueueBudgetState = 'ok' | 'warning' | 'critical';
export type SyncQueueRuntimeState = 'ok' | 'degraded' | 'blocked';

export const resolveSyncQueueBudgetState = (
  value: number,
  warningThreshold: number,
  criticalThreshold: number
): SyncQueueBudgetState => {
  if (value >= criticalThreshold) return 'critical';
  if (value >= warningThreshold) return 'warning';
  return 'ok';
};

export const resolveSyncQueueRuntimeState = (
  oldestPendingAgeMs: number,
  retrying: number
): SyncQueueRuntimeState => {
  const oldestPendingState = resolveSyncQueueBudgetState(
    oldestPendingAgeMs,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.warningOldestPendingAgeMs,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.criticalOldestPendingAgeMs
  );
  const retryingState = resolveSyncQueueBudgetState(
    retrying,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.warningRetryingSyncTasks,
    SYNC_QUEUE_RUNTIME_THRESHOLDS.criticalRetryingSyncTasks
  );

  if (oldestPendingState === 'critical' || retryingState === 'critical') {
    return 'blocked';
  }

  if (oldestPendingState === 'warning' || retryingState === 'warning') {
    return 'degraded';
  }

  return 'ok';
};
