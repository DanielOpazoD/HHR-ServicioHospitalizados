/**
 * Sync queue task contracts shared by storage services.
 */
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
}
