export type OperationalTelemetryCategory =
  | 'sync'
  | 'indexeddb'
  | 'export'
  | 'backup'
  | 'clinical_document'
  | 'create_day';

export type OperationalTelemetryStatus = 'success' | 'partial' | 'degraded' | 'failed';

export interface OperationalTelemetryEvent {
  category: OperationalTelemetryCategory;
  status: OperationalTelemetryStatus;
  operation: string;
  timestamp: string;
  date?: string;
  issues?: string[];
  context?: Record<string, unknown>;
}

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
  exportObservedCount: number;
  backupObservedCount: number;
  exportOrBackupObservedCount: number;
  latestIssueAt?: string;
}

interface ApplicationOutcomeLike {
  status: OperationalTelemetryStatus;
  issues?: Array<{ message?: string }>;
}

const STORAGE_KEY = 'operationalTelemetryEvents';
const MAX_EVENTS = 200;
const DEFAULT_WINDOW_MS = 12 * 60 * 60 * 1000;

let memoryEvents: OperationalTelemetryEvent[] = [];

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

const persistEvents = (events: OperationalTelemetryEvent[]): void => {
  memoryEvents = trimEvents(events);

  if (!canUseLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(memoryEvents));
  } catch (error) {
    console.warn('[OperationalTelemetry] Failed to persist events:', error);
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
    memoryEvents = parsed.filter(Boolean);
    return memoryEvents;
  } catch (error) {
    console.warn('[OperationalTelemetry] Failed to read persisted events:', error);
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
  const observedEvents = recentEvents.filter(
    event => event.status === 'partial' || event.status === 'degraded' || event.status === 'failed'
  );
  const failedEvents = recentEvents.filter(event => event.status === 'failed');
  const observedCategoryCount = (category: OperationalTelemetryCategory): number =>
    recentEvents.filter(event => event.category === category && event.status !== 'success').length;

  return {
    recentEventCount: recentEvents.length,
    recentFailedCount: failedEvents.length,
    recentObservedCount: observedEvents.length,
    lastHourObservedCount: lastHourEvents.filter(event => event.status !== 'success').length,
    syncFailureCount: recentEvents.filter(
      event => event.category === 'sync' && event.status === 'failed'
    ).length,
    syncObservedCount: observedCategoryCount('sync'),
    degradedLocalCount: recentEvents.filter(
      event =>
        event.category === 'indexeddb' && (event.status === 'degraded' || event.status === 'failed')
    ).length,
    indexedDbObservedCount: observedCategoryCount('indexeddb'),
    clinicalDocumentObservedCount: observedCategoryCount('clinical_document'),
    createDayObservedCount: observedCategoryCount('create_day'),
    exportObservedCount: observedCategoryCount('export'),
    backupObservedCount: observedCategoryCount('backup'),
    exportOrBackupObservedCount: recentEvents.filter(
      event =>
        (event.category === 'export' || event.category === 'backup') && event.status !== 'success'
    ).length,
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
