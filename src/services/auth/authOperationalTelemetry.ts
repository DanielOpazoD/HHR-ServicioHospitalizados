import {
  createOperationalError,
  normalizeOperationalError,
  type OperationalError,
  type OperationalErrorShape,
} from '@/services/observability/operationalError';
import { createDomainObservability } from '@/services/observability/domainObservability';

const authObservability = createDomainObservability('auth', 'Auth');

export const recordAuthOperationalError = (
  operation: string,
  error: unknown,
  fallback: OperationalErrorShape,
  options: { context?: Record<string, unknown> } = {}
): OperationalError => authObservability.recordError(operation, error, fallback, options);

export const emitAuthOperationalEvent = (
  operation: string,
  status: 'degraded' | 'failed',
  input: OperationalErrorShape
): OperationalError => {
  const operationalError = normalizeOperationalError(createOperationalError(input), input);
  authObservability.recordEvent(operation, status, {
    context: {
      errorCode: operationalError.code,
      ...operationalError.context,
    },
    issues: [operationalError.userSafeMessage || operationalError.message],
  });
  return operationalError;
};
