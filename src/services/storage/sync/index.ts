/**
 * Canonical sync queue entrypoint.
 *
 * New product code should import from this module instead of
 * `@/services/storage/syncQueueService`.
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
} from '@/services/storage/syncQueueService';

export type {
  SyncQueueDomainMetrics,
  SyncQueueOperationSnapshot,
  SyncQueueTelemetry,
} from '@/services/storage/syncQueueService';
