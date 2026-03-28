import { dispatchOperationalTelemetryExternally } from '@/services/observability/operationalTelemetryExternalAdapter';
import {
  normalizeOperationalError,
  type OperationalErrorShape,
} from '@/services/observability/operationalError';
import {
  toOperationalTelemetryStatus,
  type OperationalRuntimeState,
} from '@/services/observability/operationalRuntimeState';
import { buildOperationalTelemetrySummary } from '@/services/observability/operationalTelemetrySummary';
import type {
  OperationalOutcomeLike,
  OperationalTelemetrySummary,
} from '@/services/observability/operationalTelemetryContracts';
import {
  persistOperationalTelemetryEvents,
  readOperationalTelemetryEvents,
} from '@/services/observability/operationalTelemetryStore';
import type {
  OperationalTelemetryCategory,
  OperationalTelemetryEvent,
  OperationalTelemetryStatus,
} from '@/services/observability/operationalTelemetryTypes';
import { createScopedLogger } from '@/services/utils/loggerScope';
import {
  createRecordedOperationalTelemetryEvent,
  normalizeOperationalTelemetryIssues,
  OPERATIONAL_TELEMETRY_DEFAULT_WINDOW_MS,
} from '@/services/observability/operationalTelemetrySupport';

const operationalTelemetryLogger = createScopedLogger('OperationalTelemetry');

export { buildOperationalTelemetrySummary } from '@/services/observability/operationalTelemetrySummary';

const deriveRuntimeStateFromSeverity = (
  severity: OperationalErrorShape['severity']
): OperationalRuntimeState => {
  if (severity === 'warning' || severity === 'info') {
    return 'degraded';
  }

  return 'blocked';
};

export const shouldRecordOperationalTelemetry = (
  status: OperationalTelemetryStatus,
  options: { allowSuccess?: boolean } = {}
): boolean => {
  if (status === 'failed') return true;
  if (status === 'partial' || status === 'degraded') return true;
  return !!options.allowSuccess;
};

export const recordOperationalTelemetry = (
  input: Omit<OperationalTelemetryEvent, 'timestamp'>,
  options: { allowSuccess?: boolean } = {}
): void => {
  if (!shouldRecordOperationalTelemetry(input.status, options)) {
    return;
  }

  const event = createRecordedOperationalTelemetryEvent(input);

  const nextEvents = [
    ...readOperationalTelemetryEvents({
      onReadError: error =>
        operationalTelemetryLogger.warn('Failed to read persisted events', error),
    }),
    event,
  ];
  persistOperationalTelemetryEvents(nextEvents, {
    onPersistError: error => operationalTelemetryLogger.warn('Failed to persist events', error),
  });
  void dispatchOperationalTelemetryExternally(event);
};

export const getOperationalTelemetryEvents = (): OperationalTelemetryEvent[] =>
  readOperationalTelemetryEvents({
    onReadError: error => operationalTelemetryLogger.warn('Failed to read persisted events', error),
  });

export const clearOperationalTelemetryEvents = (): void => {
  persistOperationalTelemetryEvents([], {
    onPersistError: error => operationalTelemetryLogger.warn('Failed to persist events', error),
  });
};

export const getOperationalTelemetrySummary = (
  windowMs: number = OPERATIONAL_TELEMETRY_DEFAULT_WINDOW_MS
): OperationalTelemetrySummary =>
  buildOperationalTelemetrySummary(getOperationalTelemetryEvents(), windowMs);

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
      issues: normalizeOperationalTelemetryIssues(
        (outcome.issues || []).map(issue => issue.message || 'Sin detalle')
      ),
    },
    { allowSuccess: options.allowSuccess }
  );
};

export const recordOperationalErrorTelemetry = (
  category: OperationalTelemetryCategory,
  operation: string,
  error: unknown,
  fallback: OperationalErrorShape,
  options: {
    date?: string;
    context?: Record<string, unknown>;
  } = {}
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
    issues: normalizeOperationalTelemetryIssues([
      operationalError.userSafeMessage || operationalError.message,
    ]),
  });
  return operationalError;
};
