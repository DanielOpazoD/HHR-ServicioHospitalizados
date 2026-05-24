import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import type { SyncTask } from '@/services/storage/syncQueueTypes';

export const createSyncQueueWorkerId = (): string =>
  `sync_worker_${Math.random().toString(36).slice(2)}`;

export const createSyncQueueAttemptId = (): string =>
  `sync_attempt_${Date.now()}_${Math.random().toString(36).slice(2)}`;

export const clearSyncTaskRuntimeState = () => ({
  status: 'PENDING' as const,
  nextAttemptAt: 0,
  error: undefined,
  lastErrorCode: undefined,
  lastErrorCategory: undefined,
  lastErrorSeverity: undefined,
  lastErrorAction: undefined,
  lastErrorAt: undefined,
  leaseOwner: undefined,
  leaseUntil: undefined,
  attemptId: undefined,
  processingStartedAt: undefined,
});

export const getSyncTaskKey = (type: SyncTask['type'], payload: unknown): string | undefined => {
  if (type === 'UPDATE_DAILY_RECORD') {
    const record = payload as DailyRecord;
    return record?.date ? `daily:${record.date}` : undefined;
  }

  return undefined;
};

export const sanitizeSyncContractForOperationalSnapshot = (
  syncContract: SyncTask['syncContract']
): SyncTask['syncContract'] | undefined => {
  if (!syncContract) return undefined;
  return {
    expectedVersion: syncContract.expectedVersion,
    recordRevision: syncContract.recordRevision,
    baseRevision: syncContract.baseRevision,
    changedPaths: syncContract.changedPaths,
    mutationId: syncContract.mutationId,
    clientId: syncContract.clientId,
    tabId: syncContract.tabId,
  };
};
