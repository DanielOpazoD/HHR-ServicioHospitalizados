import {
  recordOperationalErrorTelemetry,
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';
import type { OperationalOutcomeLike } from '@/services/observability/operationalTelemetryContracts';
import type {
  OperationalTelemetryCategory,
  OperationalTelemetryEvent,
  OperationalTelemetryStatus,
} from '@/services/observability/operationalTelemetryTypes';
import type { OperationalErrorShape } from '@/services/observability/operationalError';
import { createScopedLogger } from '@/services/utils/loggerScope';

export const createDomainObservability = (
  category: OperationalTelemetryCategory,
  loggerContext: string
) => {
  const domainLogger = createScopedLogger(loggerContext);

  return {
    logger: domainLogger,
    recordEvent: (
      operation: string,
      status: OperationalTelemetryStatus,
      input: Omit<OperationalTelemetryEvent, 'category' | 'operation' | 'status' | 'timestamp'>
    ): void => {
      recordOperationalTelemetry({
        category,
        operation,
        status,
        ...input,
      });
    },
    recordOutcome: (
      operation: string,
      outcome: OperationalOutcomeLike,
      options: {
        date?: string;
        context?: Record<string, unknown>;
        allowSuccess?: boolean;
      } = {}
    ): void => {
      recordOperationalOutcome(category, operation, outcome, options);
    },
    recordError: (
      operation: string,
      error: unknown,
      fallback: OperationalErrorShape,
      options: {
        date?: string;
        context?: Record<string, unknown>;
      } = {}
    ) => recordOperationalErrorTelemetry(category, operation, error, fallback, options),
  };
};
