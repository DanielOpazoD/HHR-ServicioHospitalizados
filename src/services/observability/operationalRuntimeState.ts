export type OperationalRuntimeState =
  | 'retryable'
  | 'recoverable'
  | 'degraded'
  | 'blocked'
  | 'unauthorized';

export const OPERATIONAL_RUNTIME_STATES = [
  'retryable',
  'recoverable',
  'degraded',
  'blocked',
  'unauthorized',
] as const satisfies readonly OperationalRuntimeState[];

export const isOperationalRuntimeState = (value: unknown): value is OperationalRuntimeState =>
  OPERATIONAL_RUNTIME_STATES.includes(value as OperationalRuntimeState);

export const toOperationalTelemetryStatus = (
  runtimeState: OperationalRuntimeState
): 'degraded' | 'failed' => {
  if (
    runtimeState === 'retryable' ||
    runtimeState === 'recoverable' ||
    runtimeState === 'degraded'
  ) {
    return 'degraded';
  }

  return 'failed';
};
