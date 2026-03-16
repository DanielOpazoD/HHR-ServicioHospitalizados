/**
 * @deprecated New product code should import from `@/services/storage/sync`.
 */

export {
  ensureSyncQueueOnlineListener,
  getSyncQueueDomainMetrics,
  getSyncQueueStats,
  getSyncQueueTelemetry,
  isConflictSyncError,
  isRetryableSyncError,
  listRecentSyncQueueOperations,
  processSyncQueue,
  queueSyncTask,
} from '@/services/storage/sync/publicSyncQueue';

export type {
  SyncQueueDomainMetrics,
  SyncQueueOperationSnapshot,
  SyncQueueTelemetry,
} from '@/services/storage/sync/publicSyncQueue';
