import type { AuditWorkerResults } from '@/hooks/useAuditWorker';

export const buildInitialAuditWorkerResults = (): AuditWorkerResults => ({
  filteredLogs: [],
  displayLogs: [],
  stats: null,
});

export const isAuditWorkerProcessedMessage = (
  data: unknown
): data is { type: 'AUDIT_DATA_PROCESSED'; payload: AuditWorkerResults } =>
  !!data && typeof data === 'object' && (data as { type?: string }).type === 'AUDIT_DATA_PROCESSED';

export const isAuditWorkerErrorMessage = (
  data: unknown
): data is { type: 'ERROR'; payload: { message?: string } } =>
  !!data && typeof data === 'object' && (data as { type?: string }).type === 'ERROR';

export const normalizeAuditWorkerErrorMessage = (message?: string): string =>
  message || 'Error desconocido procesando logs de auditoría.';
