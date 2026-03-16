import {
  recordOperationalErrorTelemetry,
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';
import type {
  OperationalTelemetryCategory,
  OperationalTelemetryEvent,
  OperationalTelemetryStatus,
} from '@/services/observability/operationalTelemetryTypes';
import type { OperationalErrorShape } from '@/services/observability/operationalError';
import { logger } from '@/services/utils/loggerService';

interface ApplicationOutcomeLike {
  status: OperationalTelemetryStatus;
  issues?: Array<{ message?: string }>;
}

export const createDomainObservability = (
  category: OperationalTelemetryCategory,
  loggerContext: string
) => {
  const domainLogger = logger.child(loggerContext);

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
      outcome: ApplicationOutcomeLike,
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
