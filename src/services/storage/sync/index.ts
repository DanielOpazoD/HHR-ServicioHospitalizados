/**
 * Canonical sync queue entrypoint.
 *
 * This is the canonical sync queue surface.
 */

export {
  clearAllSyncQueue,
  clearSyncQueueForOwner,
  ensureSyncQueueOnlineListener,
  getSyncQueueDomainMetrics,
  getSyncQueueStats,
  getSyncQueueTelemetry,
  isConflictSyncError,
  isRetryableSyncError,
  listRecentSyncQueueOperations,
  processSyncQueue,
  queueDailyRecordSyncTaskWithLocalRecord,
  queueSyncTask,
  recordSyncQueueOwnershipTelemetry,
} from '@/services/storage/sync/publicSyncQueue';

export type {
  SyncQueueDomainMetrics,
  SyncQueueEnqueueResult,
  SyncQueueOperationSnapshot,
  SyncQueueTelemetry,
} from '@/services/storage/sync/publicSyncQueue';
