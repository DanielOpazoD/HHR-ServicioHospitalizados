import { ErrorLog, ErrorSeverity } from '@/services/logging/errorLogTypes';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  retryableErrors: string[];
}

export interface BuildErrorLogParams {
  message: string;
  severity?: ErrorSeverity;
  error?: Error | unknown;
  stack?: string;
  context?: Record<string, unknown>;
  userId?: string;
  userEmail?: string;
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 500,
  maxDelayMs: 5000,
  retryableErrors: [
    'unavailable',
    'resource-exhausted',
    'aborted',
    'internal',
    'deadline-exceeded',
  ],
};

const buildErrorId = (): string => `err_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

export const buildRetryDelayMs = (
  attempt: number,
  config: Pick<RetryConfig, 'baseDelayMs' | 'maxDelayMs'>
): number =>
  Math.min(config.baseDelayMs * Math.pow(2, attempt - 1) + Math.random() * 100, config.maxDelayMs);

export const isRetryableError = (
  error: unknown,
  retryableErrors: string[] = DEFAULT_RETRY_CONFIG.retryableErrors
): boolean => {
  const errorCode = (error as { code?: string })?.code || '';
  return retryableErrors.some(code => errorCode.includes(code));
};

export const buildErrorLog = ({
  message,
  severity,
  error,
  stack,
  context,
  userId,
  userEmail,
}: BuildErrorLogParams): ErrorLog => ({
  id: buildErrorId(),
  timestamp: new Date().toISOString(),
  message,
  severity: severity || 'medium',
  stack: stack || (error instanceof Error ? error.stack : undefined),
  userId,
  userEmail,
  context,
  userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
  url: typeof window !== 'undefined' ? window.location.href : undefined,
});

export const getFirebaseErrorSeverity = (code: string): ErrorSeverity => {
  if (code.includes('permission-denied')) return 'high';
  if (code.includes('not-found')) return 'medium';
  if (code.includes('unavailable')) return 'critical';
  if (code.includes('unauthenticated')) return 'medium';
  return 'medium';
};

const getFirebaseAuthMessage = (code: string): string => {
  const messages: Record<string, string> = {
    'auth/invalid-email': 'Email inválido',
    'auth/user-disabled': 'Usuario deshabilitado',
    'auth/user-not-found': 'Usuario no encontrado',
    'auth/wrong-password': 'Contraseña incorrecta',
    'auth/email-already-in-use': 'Email ya está en uso',
    'auth/weak-password': 'Contraseña muy débil',
    'auth/network-request-failed': 'Error de red. Verifique su conexión.',
    'auth/too-many-requests': 'Demasiados intentos. Intente más tarde.',
  };

  return messages[code] || 'Error de autenticación';
};

export const getUserFriendlyErrorMessage = (error: unknown): string => {
  const err = error as { code?: string; message?: string; name?: string };
  if (err?.code?.startsWith('auth/')) {
    return getFirebaseAuthMessage(err.code);
  }

  if (err?.code?.startsWith('permission-denied')) {
    return 'No tiene permisos para realizar esta acción';
  }

  if (err?.code === 'unavailable') {
    return 'Servicio temporalmente no disponible. Por favor, intente más tarde.';
  }

  if (err?.message?.includes('network') || err?.message?.includes('fetch')) {
    return 'Error de conexión. Verifique su conexión a internet.';
  }

  if (err?.name === 'ZodError') {
    return 'Los datos ingresados no son válidos. Por favor, revise los campos.';
  }

  return 'Ha ocurrido un error. Por favor, intente nuevamente.';
};
