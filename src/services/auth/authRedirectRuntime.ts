import { getFirebaseAuthConfigStatus } from '@/services/auth/firebaseAuthConfigPolicy';
import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

export type AuthRedirectRuntimeSupport = {
  isLocalhostRuntime: boolean;
  preferRedirectOnLocalhost: boolean;
  canUseRedirectAuth: boolean;
  supportLevel: 'disabled' | 'warning' | 'ready';
  redirectDisabledReason: string | null;
  supportSummary: string | null;
  supportAction: string | null;
  recommendedFlowLabel: string;
  authDomain: string;
  usesFirebaseHostedAuthDomain: boolean;
};

const isLocalhostHost = (hostname: string): boolean =>
  hostname === 'localhost' || hostname === '127.0.0.1';

export const getAuthRedirectRuntimeSupport = (): AuthRedirectRuntimeSupport => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isLocalhostRuntime = isLocalhostHost(hostname);
  const preferRedirectOnLocalhost =
    String(import.meta.env.VITE_AUTH_PREFER_REDIRECT_ON_LOCALHOST || 'false').toLowerCase() ===
    'true';
  const firebaseAuthConfig = getFirebaseAuthConfigStatus(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);

  if (isLocalhostRuntime && !preferRedirectOnLocalhost) {
    return {
      isLocalhostRuntime,
      preferRedirectOnLocalhost,
      canUseRedirectAuth: false,
      supportLevel: 'disabled',
      redirectDisabledReason:
        'En este equipo el acceso alternativo está desactivado para evitar bucles de acceso en el navegador.',
      supportSummary:
        'En localhost el sistema prefiere la ventana normal de Google y evita cambiar de pestaña automáticamente.',
      supportAction:
        'Si la ventana no aparece, usa el botón principal otra vez o revisa si el navegador bloqueó ventanas emergentes.',
      recommendedFlowLabel: 'Ventana de Google',
      authDomain: firebaseAuthConfig.authDomain,
      usesFirebaseHostedAuthDomain: firebaseAuthConfig.usesFirebaseHostedAuthDomain,
    };
  }

  if (!firebaseAuthConfig.canAttemptRedirectAuth) {
    return {
      isLocalhostRuntime,
      preferRedirectOnLocalhost,
      canUseRedirectAuth: false,
      supportLevel: firebaseAuthConfig.redirectSupportLevel,
      redirectDisabledReason: firebaseAuthConfig.redirectBlockedReason,
      supportSummary: firebaseAuthConfig.supportSummary,
      supportAction: firebaseAuthConfig.supportAction,
      recommendedFlowLabel: AUTH_UI_COPY.alternateAccessButton,
      authDomain: firebaseAuthConfig.authDomain,
      usesFirebaseHostedAuthDomain: firebaseAuthConfig.usesFirebaseHostedAuthDomain,
    };
  }

  return {
    isLocalhostRuntime,
    preferRedirectOnLocalhost,
    canUseRedirectAuth: true,
    supportLevel: firebaseAuthConfig.redirectSupportLevel,
    redirectDisabledReason: null,
    supportSummary: firebaseAuthConfig.supportSummary,
    supportAction: firebaseAuthConfig.supportAction,
    recommendedFlowLabel: AUTH_UI_COPY.alternateAccessButton,
    authDomain: firebaseAuthConfig.authDomain,
    usesFirebaseHostedAuthDomain: firebaseAuthConfig.usesFirebaseHostedAuthDomain,
  };
};
