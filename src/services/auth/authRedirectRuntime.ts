import { getFirebaseAuthConfigStatus } from '@/services/auth/firebaseAuthConfigPolicy';

export type AuthRedirectRuntimeSupport = {
  isLocalhostRuntime: boolean;
  preferRedirectOnLocalhost: boolean;
  canUseRedirectAuth: boolean;
  redirectDisabledReason: string | null;
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
      redirectDisabledReason:
        'En este equipo el acceso alternativo está desactivado para evitar que el ingreso quede dando vueltas sin terminar.',
      authDomain: firebaseAuthConfig.authDomain,
      usesFirebaseHostedAuthDomain: firebaseAuthConfig.usesFirebaseHostedAuthDomain,
    };
  }

  if (!firebaseAuthConfig.canAttemptRedirectAuth) {
    return {
      isLocalhostRuntime,
      preferRedirectOnLocalhost,
      canUseRedirectAuth: false,
      redirectDisabledReason: firebaseAuthConfig.redirectBlockedReason,
      authDomain: firebaseAuthConfig.authDomain,
      usesFirebaseHostedAuthDomain: firebaseAuthConfig.usesFirebaseHostedAuthDomain,
    };
  }

  return {
    isLocalhostRuntime,
    preferRedirectOnLocalhost,
    canUseRedirectAuth: true,
    redirectDisabledReason: null,
    authDomain: firebaseAuthConfig.authDomain,
    usesFirebaseHostedAuthDomain: firebaseAuthConfig.usesFirebaseHostedAuthDomain,
  };
};
