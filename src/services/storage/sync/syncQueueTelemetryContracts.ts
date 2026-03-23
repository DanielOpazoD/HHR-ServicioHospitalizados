import type {
  SyncQueueBudgetState,
  SyncQueueRuntimeState,
} from '@/services/storage/sync/syncQueueOperationalBudgets';

export interface SyncQueueTelemetry {
  pending: number;
  failed: number;
  conflict: number;
  retrying: number;
  oldestPendingAgeMs: number;
  batchSize: number;
  oldestPendingBudgetState: SyncQueueBudgetState;
  retryingBudgetState: SyncQueueBudgetState;
  runtimeState: SyncQueueRuntimeState;
  readState?: 'ok' | 'unavailable';
  issues?: string[];
}
