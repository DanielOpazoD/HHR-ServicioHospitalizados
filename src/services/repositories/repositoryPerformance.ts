type RepositoryMetricLevel = 'silent' | 'warn';

const now = (): number => {
  if (typeof performance !== 'undefined' && typeof performance.now === 'function') {
    return performance.now();
  }

  return Date.now();
};

const logRepositoryMetric = (
  operation: string,
  elapsedMs: number,
  level: RepositoryMetricLevel,
  context?: string
): void => {
  if (level === 'silent') {
    return;
  }

  const message = `[RepositoryPerf] ${operation} took ${Math.round(elapsedMs)}ms${
    context ? ` (${context})` : ''
  }`;
  console.warn(message);
};

interface MeasureRepositoryOperationOptions {
  thresholdMs?: number;
  context?: string;
}

export const measureRepositoryOperation = async <T>(
  operation: string,
  work: () => Promise<T>,
  options: MeasureRepositoryOperationOptions = {}
): Promise<T> => {
  const start = now();

  try {
    return await work();
  } finally {
    const elapsedMs = now() - start;
    const thresholdMs = options.thresholdMs ?? 200;
    const level: RepositoryMetricLevel = elapsedMs >= thresholdMs ? 'warn' : 'silent';
    logRepositoryMetric(operation, elapsedMs, level, options.context);
  }
};
