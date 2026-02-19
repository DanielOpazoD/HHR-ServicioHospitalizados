import { createAuthError } from '@/services/auth/authShared';

type AuthErrorLike = {
  code?: string;
  message?: string;
};

const normalize = (value: unknown): string => String(value || '').toLowerCase();

const inferCodeFromMessage = (message: string): string | null => {
  if (!message) return null;

  if (message.includes('internal assertion') || message.includes('cross-origin-opener-policy')) {
    return 'auth/popup-coop-blocked';
  }

  if (message.includes('popup blocked') || message.includes('ventana emergente')) {
    return 'auth/popup-blocked';
  }

  if (message.includes('cancelled-popup-request')) {
    return 'auth/cancelled-popup-request';
  }

  if (message.includes('network-request-failed') || message.includes('cookies')) {
    return 'auth/network-request-failed';
  }

  return null;
};

export const resolveAuthErrorCode = (error: unknown): string | null => {
  const authError = error as AuthErrorLike;
  if (typeof authError?.code === 'string' && authError.code) {
    return authError.code;
  }

  return inferCodeFromMessage(normalize(authError?.message));
};

export const isPopupRecoverableAuthError = (error: unknown): boolean => {
  const code = resolveAuthErrorCode(error);

  return (
    code === 'auth/popup-coop-blocked' ||
    code === 'auth/network-request-failed' ||
    code === 'auth/popup-blocked' ||
    code === 'auth/cancelled-popup-request' ||
    code === 'auth/multi-tab-login-in-progress'
  );
};

const GOOGLE_AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/multi-tab-login-in-progress':
    'Hay otra pestaña iniciando sesión. Espera unos segundos o usa el acceso alternativo.',
  'auth/popup-closed-by-user': 'Inicio de sesión cancelado',
  'auth/popup-blocked':
    'El navegador bloqueó la ventana emergente. Permita pop-ups para este sitio.',
  'auth/cancelled-popup-request': 'Operación cancelada',
  'auth/network-request-failed':
    'Error de conexión o bloqueo de seguridad (COOP/Cookies). Verifique su conexión o la configuración del navegador.',
  'auth/popup-coop-blocked':
    'Bloqueo de seguridad del navegador al cerrar popup (COOP). Usa acceso alternativo sin popup.',
  'auth/unauthorized-domain':
    'Dominio no autorizado en Firebase Auth. Agrega el dominio actual en Firebase > Authentication > Settings > Authorized domains.',
  'auth/invalid-api-key':
    'Clave de API inválida. Revisa las variables de entorno de Firebase configuradas en Netlify.',
};

export const toGoogleAuthError = (error: unknown): Error & { code: string } => {
  const code = resolveAuthErrorCode(error) || 'auth/google-signin-failed';
  const message = GOOGLE_AUTH_ERROR_MESSAGES[code] || 'Error al iniciar sesión con Google';
  return createAuthError(code, message);
};
