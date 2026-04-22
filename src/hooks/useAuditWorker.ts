import { useState, useEffect, useRef, useCallback } from 'react';
import { AuditLogEntry, WorkerFilterParams } from '@/types/auditLogTypes';
import {
  buildInitialAuditWorkerResults,
  normalizeAuditWorkerErrorMessage,
} from '@/hooks/controllers/auditWorkerController';
import type { AuditWorkerResults } from '@/hooks/controllers/auditWorkerContracts';
import {
  createAuditWorkerAdapter,
  type AuditWorkerAdapter,
} from '@/hooks/controllers/auditWorkerAdapter';
import { createScopedLogger } from '@/services/utils/loggerScope';

const auditWorkerLogger = createScopedLogger('AuditWorkerHook');

export const useAuditWorker = () => {
  const [results, setResults] = useState<AuditWorkerResults>(buildInitialAuditWorkerResults());
  const [isProcessing, setIsProcessing] = useState(false);
  const workerRef = useRef<AuditWorkerAdapter | null>(null);

  useEffect(() => {
    const adapter = createAuditWorkerAdapter({
      onProcessed(payload) {
        setResults(payload as AuditWorkerResults);
        setIsProcessing(false);
      },
      onError(message) {
        auditWorkerLogger.error('Audit worker error', normalizeAuditWorkerErrorMessage(message));
        setIsProcessing(false);
      },
    });
    workerRef.current = adapter;

    return () => {
      adapter.dispose();
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
      workerRef.current.processData(logs, params, actionLabels, criticalActions);
    },
    []
  );

  return {
    results,
    isProcessing,
    processData,
  };
};
