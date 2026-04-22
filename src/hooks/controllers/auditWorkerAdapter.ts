import type { AuditLogEntry, WorkerFilterParams } from '@/types/auditLogTypes';

export interface AuditWorkerAdapterMessageHandler {
  onProcessed: (payload: unknown) => void;
  onError: (message: string) => void;
}

export interface AuditWorkerAdapter {
  processData: (
    logs: AuditLogEntry[],
    params: WorkerFilterParams,
    actionLabels: Record<string, string>,
    criticalActions: string[]
  ) => void;
  dispose: () => void;
}

export const createAuditWorkerAdapter = (
  handlers: AuditWorkerAdapterMessageHandler
): AuditWorkerAdapter => {
  const worker = new Worker(new URL('../../services/admin/audit.worker.ts', import.meta.url), {
    type: 'module',
  });

  worker.onmessage = event => {
    const data = event.data as { type?: string; payload?: { message?: string } };
    if (data?.type === 'AUDIT_DATA_PROCESSED') {
      handlers.onProcessed(data.payload);
      return;
    }
    if (data?.type === 'AUDIT_WORKER_ERROR') {
      handlers.onError(String(data.payload?.message || 'Error del worker de auditoría.'));
    }
  };

  return {
    processData(logs, params, actionLabels, criticalActions) {
      worker.postMessage({
        type: 'PROCESS_AUDIT_DATA',
        payload: { logs, params, actionLabels, criticalActions },
      });
    },
    dispose() {
      worker.terminate();
    },
  };
};
