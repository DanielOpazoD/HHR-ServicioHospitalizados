import { useCallback, useEffect, useState } from 'react';
import {
  getSyncQueueTelemetry,
  listRecentSyncQueueOperations,
  type SyncQueueOperationSnapshot,
} from '@/services/storage/sync';
import { createScopedLogger } from '@/services/utils/loggerScope';
import type { SyncQueueRuntimeState } from '@/services/storage/sync/syncQueueOperationalBudgets';

export const SYNC_QUEUE_POLL_INTERVAL_MS = 4000;
const syncQueueMonitorLogger = createScopedLogger('useSyncQueueMonitor');

interface UseSyncQueueMonitorOptions {
  enabled?: boolean;
  pollIntervalMs?: number;
  operationLimit?: number;
}

const EMPTY_STATS: SyncQueueStats = {
  pending: 0,
  failed: 0,
  retrying: 0,
  acked: 0,
  conflict: 0,
};

export interface SyncQueueStats {
  pending: number;
  failed: number;
  retrying: number;
  acked: number;
  conflict: number;
  batchSize?: number;
  runtimeState?: SyncQueueRuntimeState;
  readState?: 'ok' | 'unavailable';
}

export interface SyncQueueOperation {
  id?: SyncQueueOperationSnapshot['id'];
  type: SyncQueueOperationSnapshot['type'];
  status: SyncQueueOperationSnapshot['status'];
  retryCount: number;
  timestamp: number;
  nextAttemptAt?: number;
  error?: string;
  key?: string;
}

export const useSyncQueueMonitor = (
  options: UseSyncQueueMonitorOptions = {}
): {
  stats: SyncQueueStats;
  operations: SyncQueueOperation[];
  hasQueueIssues: boolean;
  refresh: () => Promise<void>;
} => {
  const {
    enabled = true,
    pollIntervalMs = SYNC_QUEUE_POLL_INTERVAL_MS,
    operationLimit = 5,
  } = options;
  const [stats, setStats] = useState<SyncQueueStats>(EMPTY_STATS);
  const [operations, setOperations] = useState<SyncQueueOperation[]>([]);

  const refresh = useCallback(async () => {
    try {
      const [nextStats, nextOps] = await Promise.all([
        getSyncQueueTelemetry(),
        listRecentSyncQueueOperations(operationLimit),
      ]);
      setStats({
        pending: nextStats.pending,
        failed: nextStats.failed,
        retrying: nextStats.retrying,
        acked: 0,
        conflict: nextStats.conflict || 0,
        batchSize: nextStats.batchSize,
        runtimeState: nextStats.runtimeState,
        readState: nextStats.readState,
      });
      setOperations(nextOps);
    } catch (error) {
      syncQueueMonitorLogger.warn('Failed to refresh queue monitor', error);
    }
  }, [operationLimit]);

  useEffect(() => {
    if (!enabled) return;

    let active = true;

    const run = async () => {
      if (!active) return;
      await refresh();
    };

    void run();
    const intervalId = setInterval(() => {
      void run();
    }, pollIntervalMs);

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [enabled, pollIntervalMs, refresh]);

  const hasQueueIssues =
    stats.pending > 0 ||
    stats.retrying > 0 ||
    stats.failed > 0 ||
    stats.conflict > 0 ||
    stats.runtimeState === 'degraded' ||
    stats.runtimeState === 'blocked' ||
    stats.readState === 'unavailable';

  return { stats, operations, hasQueueIssues, refresh };
};
