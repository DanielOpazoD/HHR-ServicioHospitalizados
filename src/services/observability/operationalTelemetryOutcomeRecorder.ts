import type { OperationalOutcomeLike } from '@/services/observability/operationalTelemetryContracts';
import type { OperationalTelemetryCategory } from '@/services/observability/operationalTelemetryTypes';
import {
  normalizeOperationalError,
  type OperationalErrorShape,
} from '@/services/observability/operationalError';
import {
  toOperationalTelemetryStatus,
  type OperationalRuntimeState,
} from '@/services/observability/operationalRuntimeState';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryRecorder';

interface OperationalTelemetryRecordOptions {
  date?: string;
  context?: Record<string, unknown>;
}

const deriveRuntimeStateFromSeverity = (
  severity: OperationalErrorShape['severity']
): OperationalRuntimeState => {
  if (severity === 'warning' || severity === 'info') {
    return 'degraded';
  }

  return 'blocked';
};

export const recordOperationalOutcome = (
  category: OperationalTelemetryCategory,
  operation: string,
  outcome: OperationalOutcomeLike,
  options: {
    date?: string;
    context?: Record<string, unknown>;
    allowSuccess?: boolean;
  } = {}
): void => {
  recordOperationalTelemetry(
    {
      category,
      operation,
      status: outcome.status,
      date: options.date,
      context: options.context,
      issues: (outcome.issues || []).map(issue => issue.message || 'Sin detalle'),
    },
    { allowSuccess: options.allowSuccess }
  );
};

export const recordOperationalErrorTelemetry = (
  category: OperationalTelemetryCategory,
  operation: string,
  error: unknown,
  fallback: OperationalErrorShape,
  options: OperationalTelemetryRecordOptions = {}
) => {
  const operationalError = normalizeOperationalError(error, fallback);
  const runtimeState =
    operationalError.runtimeState || deriveRuntimeStateFromSeverity(operationalError.severity);

  recordOperationalTelemetry({
    category,
    operation,
    status: toOperationalTelemetryStatus(runtimeState),
    runtimeState,
    date: options.date,
    context: {
      errorCode: operationalError.code,
      ...operationalError.context,
      ...options.context,
    },
    issues: [operationalError.userSafeMessage || operationalError.message],
  });

  return operationalError;
};
