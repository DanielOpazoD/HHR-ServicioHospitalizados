/**
 * Sync queue task contracts shared by storage services.
 */
import type {
  SyncDomainContext,
  SyncTaskOrigin,
} from '@/services/storage/sync/syncDomainContracts';

export interface SyncTask {
  id?: number;
  opId: string;
  type: 'UPDATE_DAILY_RECORD' | 'UPDATE_PATIENT';
  payload: unknown;
  timestamp: number;
  retryCount: number;
  nextAttemptAt?: number;
  status: 'PENDING' | 'PROCESSING' | 'FAILED' | 'CONFLICT';
  error?: string;
  lastErrorCode?: string;
  lastErrorCategory?: 'conflict' | 'authorization' | 'validation' | 'network' | 'unknown';
  lastErrorSeverity?: 'low' | 'medium' | 'high' | 'critical';
  lastErrorAction?: string;
  lastErrorAt?: number;
  key?: string;
  ownerKey?: string;
  leaseOwner?: string;
  leaseUntil?: number;
  attemptId?: string;
  processingStartedAt?: number;
  preOutboxHoldOwner?: string;
  preOutboxHoldUntil?: number;
  preOutboxHoldReason?: 'awaiting_remote_ack';
  contexts?: SyncDomainContext[];
  origin?: SyncTaskOrigin;
  recoveryPolicy?: string;
  syncContract?: SyncTaskContract;
}

export interface SyncTaskContract {
  expectedVersion?: string;
  baseRevision?: number;
  recordRevision?: string;
  clinicalEpisodeKeys?: string[];
  changedPaths?: string[];
  mutationId?: string;
  mutationIds?: string[];
  clientId?: string;
  tabId?: string;
}
