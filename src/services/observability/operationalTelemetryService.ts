import { dispatchOperationalTelemetryExternally } from '@/services/observability/operationalTelemetryExternalAdapter';
import {
  normalizeOperationalError,
  type OperationalErrorShape,
} from '@/services/observability/operationalError';
import {
  toOperationalTelemetryStatus,
  type OperationalRuntimeState,
} from '@/services/observability/operationalRuntimeState';
import type {
  OperationalOutcomeLike,
  OperationalTelemetrySummary,
} from '@/services/observability/operationalTelemetryContracts';
import type {
  OperationalTelemetryCategory,
  OperationalTelemetryEvent,
  OperationalTelemetryStatus,
} from '@/services/observability/operationalTelemetryTypes';
import { createScopedLogger } from '@/services/utils/loggerScope';
import {
  buildTopObservedOperationalKey,
  canUseOperationalTelemetryLocalStorage,
  createRecordedOperationalTelemetryEvent,
  isDefinedOperationalTelemetryEvent,
  isObservedOperationalTelemetryStatus,
  normalizeOperationalTelemetryIssues,
  OBSERVED_CATEGORY_ORDER,
  OPERATIONAL_TELEMETRY_DEFAULT_WINDOW_MS,
  OPERATIONAL_TELEMETRY_STORAGE_KEY,
  sanitizePersistedOperationalTelemetryEvent,
  trimOperationalTelemetryEvents,
} from '@/services/observability/operationalTelemetrySupport';

let memoryEvents: OperationalTelemetryEvent[] = [];
const operationalTelemetryLogger = createScopedLogger('OperationalTelemetry');

const deriveRuntimeStateFromSeverity = (
  severity: OperationalErrorShape['severity']
): OperationalRuntimeState => {
  if (severity === 'warning' || severity === 'info') {
    return 'degraded';
  }

  return 'blocked';
};

const persistEvents = (events: OperationalTelemetryEvent[]): void => {
  memoryEvents = trimOperationalTelemetryEvents(events);

  if (!canUseOperationalTelemetryLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(OPERATIONAL_TELEMETRY_STORAGE_KEY, JSON.stringify(memoryEvents));
  } catch (error) {
    operationalTelemetryLogger.warn('Failed to persist events', error);
  }
};

const readPersistedEvents = (): OperationalTelemetryEvent[] => {
  if (memoryEvents.length > 0) {
    return memoryEvents;
  }

  if (!canUseOperationalTelemetryLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(OPERATIONAL_TELEMETRY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    memoryEvents = trimOperationalTelemetryEvents(
      parsed
        .map(sanitizePersistedOperationalTelemetryEvent)
        .filter(isDefinedOperationalTelemetryEvent)
    );
    return memoryEvents;
  } catch (error) {
    operationalTelemetryLogger.warn('Failed to read persisted events', error);
    return [];
  }
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

  const nextEvents = [...readPersistedEvents(), event];
  persistEvents(nextEvents);
  void dispatchOperationalTelemetryExternally(event);
};

export const getOperationalTelemetryEvents = (): OperationalTelemetryEvent[] =>
  readPersistedEvents();

export const clearOperationalTelemetryEvents = (): void => {
  persistEvents([]);
};

export const buildOperationalTelemetrySummary = (
  events: OperationalTelemetryEvent[],
  windowMs: number = OPERATIONAL_TELEMETRY_DEFAULT_WINDOW_MS
): OperationalTelemetrySummary => {
  const now = Date.now();
  const recentEvents = events.filter(event => now - Date.parse(event.timestamp) <= windowMs);
  const lastHourEvents = events.filter(
    event => now - Date.parse(event.timestamp) <= 60 * 60 * 1000
  );
  const observedEvents = recentEvents.filter(event =>
    isObservedOperationalTelemetryStatus(event.status)
  );
  const failedEvents = recentEvents.filter(event => event.status === 'failed');
  const observedCategoryCounts = OBSERVED_CATEGORY_ORDER.reduce<Record<string, number>>(
    (acc, category) => {
      acc[category] = recentEvents.filter(
        event => event.category === category && isObservedOperationalTelemetryStatus(event.status)
      ).length;
      return acc;
    },
    {}
  );
  const topObservedCategory = buildTopObservedOperationalKey(
    observedEvents.map(event => event.category)
  );
  const topObservedOperation = buildTopObservedOperationalKey(
    observedEvents.map(event => event.operation)
  );
  const latestObservedOperation = observedEvents.at(-1)?.operation;
  const countRuntimeState = (runtimeState: OperationalRuntimeState): number =>
    recentEvents.filter(event => event.runtimeState === runtimeState).length;
  const latestRuntimeState = [...observedEvents]
    .reverse()
    .find(event => event.runtimeState)?.runtimeState;
  const countOperation = (operation: string): number =>
    recentEvents.filter(event => event.operation === operation).length;

  return {
    recentEventCount: recentEvents.length,
    recentFailedCount: failedEvents.length,
    recentObservedCount: observedEvents.length,
    recentRetryableCount: countRuntimeState('retryable'),
    recentRecoverableCount: countRuntimeState('recoverable'),
    recentDegradedCount: countRuntimeState('degraded'),
    recentBlockedCount: countRuntimeState('blocked'),
    recentUnauthorizedCount: countRuntimeState('unauthorized'),
    lastHourObservedCount: lastHourEvents.filter(event =>
      isObservedOperationalTelemetryStatus(event.status)
    ).length,
    syncFailureCount: recentEvents.filter(
      event => event.category === 'sync' && event.status === 'failed'
    ).length,
    syncObservedCount: observedCategoryCounts.sync || 0,
    degradedLocalCount: recentEvents.filter(
      event =>
        event.category === 'indexeddb' && (event.status === 'degraded' || event.status === 'failed')
    ).length,
    indexedDbObservedCount: observedCategoryCounts.indexeddb || 0,
    clinicalDocumentObservedCount: observedCategoryCounts.clinical_document || 0,
    createDayObservedCount: observedCategoryCounts.create_day || 0,
    handoffObservedCount: observedCategoryCounts.handoff || 0,
    exportObservedCount: observedCategoryCounts.export || 0,
    backupObservedCount: observedCategoryCounts.backup || 0,
    exportOrBackupObservedCount: recentEvents.filter(
      event =>
        (event.category === 'export' || event.category === 'backup') &&
        isObservedOperationalTelemetryStatus(event.status)
    ).length,
    dailyRecordRecoveredRealtimeNullCount: countOperation('recovered_null_realtime_record'),
    dailyRecordConfirmedRealtimeNullCount: countOperation('confirmed_null_realtime_record'),
    syncReadUnavailableCount:
      countOperation('sync_queue_telemetry_unavailable') +
      countOperation('sync_queue_stats_unavailable') +
      countOperation('sync_queue_recent_operations_unavailable') +
      countOperation('sync_queue_domain_metrics_unavailable'),
    indexedDbFallbackModeCount: countOperation('indexeddb_fallback_mode'),
    authBootstrapTimeoutCount: countOperation('bootstrap_timeout'),
    topObservedCategory,
    topObservedOperation,
    latestObservedOperation,
    latestRuntimeState,
    latestIssueAt: observedEvents.at(-1)?.timestamp,
  };
};

export const getOperationalTelemetrySummary = (
  windowMs: number = OPERATIONAL_TELEMETRY_DEFAULT_WINDOW_MS
): OperationalTelemetrySummary => buildOperationalTelemetrySummary(readPersistedEvents(), windowMs);

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
