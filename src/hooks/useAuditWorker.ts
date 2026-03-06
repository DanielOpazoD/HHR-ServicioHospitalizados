import { useState, useEffect, useRef, useCallback } from 'react';
import { AuditLogEntry, GroupedAuditLogEntry, AuditStats, WorkerFilterParams } from '@/types/audit';
import {
  buildInitialAuditWorkerResults,
  isAuditWorkerErrorMessage,
  isAuditWorkerProcessedMessage,
  normalizeAuditWorkerErrorMessage,
} from '@/hooks/controllers/auditWorkerController';

export interface AuditWorkerResults {
  filteredLogs: AuditLogEntry[];
  displayLogs: (AuditLogEntry | GroupedAuditLogEntry)[];
  stats: AuditStats | null;
}

export const useAuditWorker = () => {
  const [results, setResults] = useState<AuditWorkerResults>(buildInitialAuditWorkerResults());
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    // Initialize worker using Vite's URL constructor pattern
    const worker = new Worker(new URL('../services/admin/audit.worker.ts', import.meta.url), {
      type: 'module',
    });

    worker.onmessage = event => {
      if (isAuditWorkerProcessedMessage(event.data)) {
        setResults(event.data.payload);
        setIsProcessing(false);
        return;
      }
      if (isAuditWorkerErrorMessage(event.data)) {
        console.error(
          '[AuditWorker Hook] Error:',
          normalizeAuditWorkerErrorMessage(event.data.payload.message)
        );
        setIsProcessing(false);
      }
    };

    workerRef.current = worker;

    return () => {
      worker.terminate();
    };
  }, []);

  const processData = useCallback(
    (
      logs: AuditLogEntry[],
      params: WorkerFilterParams,
      actionLabels: Record<string, string>,
      criticalActions: string[]
    ) => {
      if (!workerRef.current) return;

      setIsProcessing(true);
      workerRef.current.postMessage({
        type: 'PROCESS_AUDIT_DATA',
        payload: { logs, params, actionLabels, criticalActions },
      });
    },
    []
  );

  return {
    results,
    isProcessing,
    processData,
  };
};
