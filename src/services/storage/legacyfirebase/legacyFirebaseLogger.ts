import { createScopedLogger } from '@/services/utils/loggerScope';

const isTestEnvironment = (): boolean =>
  typeof process !== 'undefined' &&
  (process.env.VITEST === 'true' || process.env.NODE_ENV === 'test');

const legacyFirebaseLogger = createScopedLogger('LegacyFirebase');

const isLegacyDebugEnabled = (): boolean =>
  !isTestEnvironment() &&
  import.meta.env.DEV &&
  String(import.meta.env.VITE_DEBUG_LEGACY_FIREBASE || '').toLowerCase() === 'true';

const flattenErrorText = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    return value.map(item => flattenErrorText(item)).join(' ');
  }
  if (typeof value === 'object') {
    const entries = Object.values(value as Record<string, unknown>);
    return entries.map(entry => flattenErrorText(entry)).join(' ');
  }
  return '';
};

export const isLegacyPermissionDeniedError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const typed = error as { code?: string; message?: string };
  const code = String(typed.code || '').toLowerCase();
  if (code === 'permission-denied' || code === 'firestore/permission-denied') {
    return true;
  }
  if (code.includes('permission') && code.includes('denied')) return true;

  const message = flattenErrorText(error).toLowerCase();
  return (
    message.includes('missing or insufficient permissions') ||
    message.includes('insufficient permissions') ||
    message.includes('permission denied') ||
    message.includes('permission-denied')
  );
};

export const logLegacyInfo = (message: string): void => {
  if (!isLegacyDebugEnabled()) return;
  legacyFirebaseLogger.warn(message);
};

export const logLegacyError = (message: string, error: unknown): void => {
  if (isLegacyPermissionDeniedError(error) && !isLegacyDebugEnabled()) {
    return;
  }
  legacyFirebaseLogger.error(message, error);
};
