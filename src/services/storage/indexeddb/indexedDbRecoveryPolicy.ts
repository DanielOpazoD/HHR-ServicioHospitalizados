const BACKING_STORE_ERROR_FRAGMENT = 'internal error opening backing store';

const getErrorName = (error: unknown): string =>
  error && typeof error === 'object' && 'name' in error ? String(error.name) : '';

const getErrorMessage = (error: unknown): string =>
  error && typeof error === 'object' && 'message' in error ? String(error.message) : String(error);

export const shouldUseStickyIndexedDbFallback = (error: unknown): boolean => {
  const name = getErrorName(error);
  const message = getErrorMessage(error).toLowerCase();

  return name === 'UnknownError' && message.includes(BACKING_STORE_ERROR_FRAGMENT);
};

export const shouldScheduleBackgroundIndexedDbRecovery = (
  attempts: number,
  maxAttempts: number,
  stickyFallbackMode: boolean
): boolean => !stickyFallbackMode && attempts < maxAttempts;

export const shouldLogIndexedDbRuntimeWarning = (
  warningKey: string,
  stickyFallbackMode: boolean,
  emittedWarnings: Set<string>
): boolean => {
  if (stickyFallbackMode && warningKey === 'unexpected-close') {
    return false;
  }

  if (emittedWarnings.has(warningKey)) {
    return false;
  }

  emittedWarnings.add(warningKey);
  return true;
};
