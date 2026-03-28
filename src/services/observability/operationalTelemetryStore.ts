import type { OperationalTelemetryEvent } from '@/services/observability/operationalTelemetryTypes';
import {
  canUseOperationalTelemetryLocalStorage,
  isDefinedOperationalTelemetryEvent,
  OPERATIONAL_TELEMETRY_STORAGE_KEY,
  sanitizePersistedOperationalTelemetryEvent,
  trimOperationalTelemetryEvents,
} from '@/services/observability/operationalTelemetrySupport';

let memoryEvents: OperationalTelemetryEvent[] = [];

export const persistOperationalTelemetryEvents = (
  events: OperationalTelemetryEvent[],
  options: { onPersistError?: (error: unknown) => void } = {}
): void => {
  memoryEvents = trimOperationalTelemetryEvents(events);

  if (!canUseOperationalTelemetryLocalStorage()) {
    return;
  }

  try {
    window.localStorage.setItem(OPERATIONAL_TELEMETRY_STORAGE_KEY, JSON.stringify(memoryEvents));
  } catch (error) {
    options.onPersistError?.(error);
  }
};

export const readOperationalTelemetryEvents = (
  options: { onReadError?: (error: unknown) => void } = {}
): OperationalTelemetryEvent[] => {
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
    options.onReadError?.(error);
    return [];
  }
};
