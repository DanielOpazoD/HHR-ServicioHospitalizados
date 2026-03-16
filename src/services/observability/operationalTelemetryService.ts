import { dispatchOperationalTelemetryExternally } from '@/services/observability/operationalTelemetryExternalAdapter';
import {
  normalizeOperationalError,
  type OperationalErrorShape,
} from '@/services/observability/operationalError';
import type {
  OperationalTelemetryCategory,
  OperationalTelemetryEvent,
  OperationalTelemetryStatus,
} from '@/services/observability/operationalTelemetryTypes';
import { logger } from '@/services/utils/loggerService';

export interface OperationalTelemetrySummary {
  recentEventCount: number;
  recentFailedCount: number;
  recentObservedCount: number;
  lastHourObservedCount: number;
  syncFailureCount: number;
  syncObservedCount: number;
  degradedLocalCount: number;
  indexedDbObservedCount: number;
  clinicalDocumentObservedCount: number;
  createDayObservedCount: number;
  handoffObservedCount: number;
  exportObservedCount: number;
  backupObservedCount: number;
  exportOrBackupObservedCount: number;
  topObservedCategory?: OperationalTelemetryCategory;
  topObservedOperation?: string;
  latestObservedOperation?: string;
  latestIssueAt?: string;
}

interface ApplicationOutcomeLike {
  status: OperationalTelemetryStatus;
  issues?: Array<{ message?: string }>;
}

const STORAGE_KEY = 'operationalTelemetryEvents';
const MAX_EVENTS = 200;
const DEFAULT_WINDOW_MS = 12 * 60 * 60 * 1000;
const OBSERVED_STATUSES: OperationalTelemetryStatus[] = ['partial', 'degraded', 'failed'];
const OBSERVED_CATEGORY_ORDER: OperationalTelemetryCategory[] = [
  'sync',
  'indexeddb',
  'clinical_document',
  'create_day',
  'handoff',
  'export',
  'backup',
];

let memoryEvents: OperationalTelemetryEvent[] = [];
const operationalTelemetryLogger = logger.child('OperationalTelemetry');

const canUseLocalStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const normalizeIssues = (issues?: string[]): string[] | undefined => {
  if (!issues || issues.length === 0) return undefined;
  const normalized = issues.map(issue => String(issue).trim()).filter(Boolean);
  return normalized.length > 0 ? normalized.slice(0, 5) : undefined;
};

const sanitizeContext = (
  context?: Record<string, unknown>
): Record<string, unknown> | undefined => {
  if (!context) return undefined;
  const sanitizedEntries = Object.entries(context)
    .filter(([, value]) => value !== undefined)
    .slice(0, 12)
    .map(([key, value]) => {
      if (
        value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        return [key, value];
      }
      return [key, JSON.stringify(value)];
    });

  return sanitizedEntries.length > 0 ? Object.fromEntries(sanitizedEntries) : undefined;
};

const trimEvents = (events: OperationalTelemetryEvent[]): OperationalTelemetryEvent[] =>
  events.slice(-MAX_EVENTS);

const isOperationalTelemetryStatus = (value: unknown): value is OperationalTelemetryStatus =>
  value === 'success' || value === 'partial' || value === 'degraded' || value === 'failed';

const isOperationalTelemetryCategory = (value: unknown): value is OperationalTelemetryCategory =>
  value === 'auth' ||
  value === 'daily_record' ||
  value === 'firestore' ||
  value === 'sync' ||
  value === 'indexeddb' ||
  value === 'integration' ||
  value === 'export' ||
  value === 'backup' ||
  value === 'reminders' ||
  value === 'transfers' ||
  value === 'clinical_document' ||
  value === 'create_day' ||
  value === 'handoff';

const sanitizePersistedEvent = (value: unknown): OperationalTelemetryEvent | null => {
  if (!value || typeof value !== 'object') return null;
  const event = value as Partial<OperationalTelemetryEvent>;
  if (
    !isOperationalTelemetryCategory(event.category) ||
    !isOperationalTelemetryStatus(event.status) ||
    typeof event.operation !== 'string' ||
    event.operation.trim().length === 0 ||
    typeof event.timestamp !== 'string' ||
    Number.isNaN(Date.parse(event.timestamp))
  ) {
    return null;
  }

  return {
    category: event.category,
    status: event.status,
    operation: event.operation,
    timestamp: event.timestamp,
    date: typeof event.date === 'string' ? event.date : undefined,
    issues: Array.isArray(event.issues) ? normalizeIssues(event.issues) : undefined,
    context:
      event.context && typeof event.context === 'object'
        ? sanitizeContext(event.context as Record<string, unknown>)
        : undefined,
  };
};

const isObservedStatus = (status: OperationalTelemetryStatus): boolean =>
  OBSERVED_STATUSES.includes(status);

const isDefinedEvent = (
  event: OperationalTelemetryEvent | null
): event is OperationalTelemetryEvent => event !== null;

const persistEvents = (events: OperationalTelemetryEvent[]): void => {
  memoryEvents = trimEvents(events);

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryEvents));
  } catch (error) {
    operationalTelemetryLogger.warn('Failed to persist events', error);
  }
};

const readPersistedEvents = (): OperationalTelemetryEvent[] => {
  if (memoryEvents.length > 0) {
    return memoryEvents;
  }

  if (!canUseLocalStorage()) {
    return [];
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    memoryEvents = trimEvents(parsed.map(sanitizePersistedEvent).filter(isDefinedEvent));
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

  const event: OperationalTelemetryEvent = {
    ...input,
    timestamp: new Date().toISOString(),
    issues: normalizeIssues(input.issues),
    context: sanitizeContext(input.context),
  };

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
  windowMs: number = DEFAULT_WINDOW_MS
): OperationalTelemetrySummary => {
  const now = Date.now();
  const recentEvents = events.filter(event => now - Date.parse(event.timestamp) <= windowMs);
  const lastHourEvents = events.filter(
    event => now - Date.parse(event.timestamp) <= 60 * 60 * 1000
  );
  const observedEvents = recentEvents.filter(event => isObservedStatus(event.status));
  const buildTopKey = <T extends string>(values: T[]): T | undefined => {
    if (values.length === 0) return undefined;
    const counts = values.reduce<Record<string, number>>((acc, value) => {
      acc[value] = (acc[value] || 0) + 1;
      return acc;
    }, {});
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] as T | undefined;
  };
  const failedEvents = recentEvents.filter(event => event.status === 'failed');
  const observedCategoryCounts = OBSERVED_CATEGORY_ORDER.reduce<Record<string, number>>(
    (acc, category) => {
      acc[category] = recentEvents.filter(
        event => event.category === category && isObservedStatus(event.status)
      ).length;
      return acc;
    },
    {}
  );
  const topObservedCategory = buildTopKey(observedEvents.map(event => event.category));
  const topObservedOperation = buildTopKey(observedEvents.map(event => event.operation));
  const latestObservedOperation = observedEvents.at(-1)?.operation;

  return {
    recentEventCount: recentEvents.length,
    recentFailedCount: failedEvents.length,
    recentObservedCount: observedEvents.length,
    lastHourObservedCount: lastHourEvents.filter(event => isObservedStatus(event.status)).length,
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
        isObservedStatus(event.status)
    ).length,
    topObservedCategory,
    topObservedOperation,
    latestObservedOperation,
    latestIssueAt: observedEvents.at(-1)?.timestamp,
  };
};

export const getOperationalTelemetrySummary = (
  windowMs: number = DEFAULT_WINDOW_MS
): OperationalTelemetrySummary => buildOperationalTelemetrySummary(readPersistedEvents(), windowMs);

export const recordOperationalOutcome = (
  category: OperationalTelemetryCategory,
  operation: string,
  outcome: ApplicationOutcomeLike,
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
  options: {
    date?: string;
    context?: Record<string, unknown>;
  } = {}
) => {
  const operationalError = normalizeOperationalError(error, fallback);
  recordOperationalTelemetry({
    category,
    operation,
    status:
      operationalError.severity === 'warning' || operationalError.severity === 'info'
        ? 'degraded'
        : 'failed',
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
