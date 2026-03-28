import { filterLogs, groupLogs, calculateAuditStats, WorkerFilterParams } from './auditWorkerLogic';
import { AuditLogEntry } from '@/types/audit';
import { auditWorkerLogger } from '@/services/admin/adminLoggers';

/**
 * Audit Web Worker
 * Processes audit logs in the background to avoid blocking the main thread.
 */

self.onmessage = (event: MessageEvent) => {
  const { type, payload } = event.data;

  try {
    switch (type) {
      case 'PROCESS_AUDIT_DATA': {
        const { logs, params, actionLabels, criticalActions } = payload as {
          logs: AuditLogEntry[];
          params: WorkerFilterParams;
          actionLabels: Record<string, string>;
          criticalActions: string[];
        };

        // 1. Filter
        const filtered = filterLogs(logs, params);

        // 2. Group
        const display = params.groupedView ? groupLogs(filtered, actionLabels) : filtered;

        // 3. Stats
        const stats = calculateAuditStats(filtered, criticalActions);

        self.postMessage({
          type: 'AUDIT_DATA_PROCESSED',
          payload: {
            filteredLogs: filtered,
            displayLogs: display,
            stats,
          },
        });
        break;
      }

      case 'PING':
        self.postMessage({ type: 'PONG' });
        break;

      default:
        auditWorkerLogger.warn(`Unknown message type: ${type}`);
    }
  } catch (error) {
    auditWorkerLogger.error('Error processing data', error);
    self.postMessage({
      type: 'ERROR',
      payload: {
        message: error instanceof Error ? error.message : 'Unknown error',
      },
    });
  }
};
