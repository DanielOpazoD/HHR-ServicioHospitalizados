import { useCallback, useEffect, useState } from 'react';
import { getSyncQueueStats } from '@/services/storage/syncQueueService';
import { hospitalDB } from '@/services/storage/indexedDBService';
import { SyncTask } from '@/services/storage/syncQueueTypes';

export const SYNC_QUEUE_POLL_INTERVAL_MS = 4000;

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
}

export interface SyncQueueOperation {
  id?: number;
  type: SyncTask['type'];
  status: SyncTask['status'];
  retryCount: number;
  timestamp: number;
  nextAttemptAt?: number;
  error?: string;
  key?: string;
}

const listRecentSyncQueueOperations = async (limit: number): Promise<SyncQueueOperation[]> => {
  try {
    const rows = await hospitalDB.syncQueue.orderBy('timestamp').reverse().limit(limit).toArray();
    return rows.map(row => ({
      id: row.id,
      type: row.type,
      status: row.status,
      retryCount: row.retryCount,
      timestamp: row.timestamp,
      nextAttemptAt: row.nextAttemptAt,
      error: row.error,
      key: row.key,
    }));
  } catch (error) {
    console.warn('[SyncQueueMonitor] Failed to list queue operations:', error);
    return [];
  }
};

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
        getSyncQueueStats(),
        listRecentSyncQueueOperations(operationLimit),
      ]);
      const retrying = nextOps.filter(op => op.status === 'PENDING' && op.retryCount > 0).length;
      setStats({
        pending: nextStats.pending,
        failed: nextStats.failed,
        retrying,
        acked: 0,
        conflict: 0,
      });
      setOperations(nextOps);
    } catch (error) {
      console.warn('[SyncQueueMonitor] Failed to refresh queue monitor:', error);
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
    stats.pending > 0 || stats.retrying > 0 || stats.failed > 0 || stats.conflict > 0;

  return { stats, operations, hasQueueIssues, refresh };
};
