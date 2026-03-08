import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';

export const recordIndexedDbRecoveryFailure = (error: unknown): void => {
  recordOperationalTelemetry({
    category: 'indexeddb',
    status: 'failed',
    operation: 'indexeddb_recovery',
    issues: [error instanceof Error ? error.message : 'Recovery failed'],
  });
};

export const recordIndexedDbFallbackMode = (errorName: string, errorMessage: string): void => {
  recordOperationalTelemetry({
    category: 'indexeddb',
    status: 'degraded',
    operation: 'indexeddb_fallback_mode',
    issues: [errorMessage || 'IndexedDB fallback activated'],
    context: { errorName },
  });
};
