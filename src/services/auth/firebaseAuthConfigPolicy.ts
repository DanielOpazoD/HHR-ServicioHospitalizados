const FIREBASE_HOSTING_DOMAIN_SUFFIXES = ['.firebaseapp.com', '.web.app'] as const;

export type FirebaseAuthConfigStatus = {
  authDomain: string;
  hasAuthDomain: boolean;
  usesFirebaseHostedAuthDomain: boolean;
  canAttemptRedirectAuth: boolean;
  redirectBlockedReason: string | null;
  supportSummary: string | null;
  supportAction: string | null;
};

const isFirebaseHostedAuthDomain = (authDomain: string): boolean =>
  FIREBASE_HOSTING_DOMAIN_SUFFIXES.some(suffix => authDomain.endsWith(suffix));

export const getFirebaseAuthConfigStatus = (
  authDomainRaw: string | undefined | null
): FirebaseAuthConfigStatus => {
  const authDomain = String(authDomainRaw || '')
    .trim()
    .toLowerCase();
  const hasAuthDomain = authDomain.length > 0;
  const usesFirebaseHostedAuthDomain = hasAuthDomain && isFirebaseHostedAuthDomain(authDomain);

  if (!hasAuthDomain) {
    return {
      authDomain,
      hasAuthDomain,
      usesFirebaseHostedAuthDomain: false,
      canAttemptRedirectAuth: false,
      redirectBlockedReason:
        'Esta copia del sistema no tiene habilitado el acceso alternativo de Google.',
      supportSummary: 'Falta el dominio de autenticación de Firebase.',
      supportAction: 'Configura VITE_FIREBASE_AUTH_DOMAIN antes de usar acceso alternativo.',
    };
  }

  return {
    authDomain,
    hasAuthDomain,
    usesFirebaseHostedAuthDomain,
    canAttemptRedirectAuth: true,
    redirectBlockedReason: null,
    supportSummary: usesFirebaseHostedAuthDomain
      ? null
      : `El dominio de autenticación configurado (${authDomain}) no usa el hosting estándar de Firebase.`,
    supportAction: usesFirebaseHostedAuthDomain
      ? null
      : 'Si vas a usar acceso alternativo, confirma que el dominio tenga disponible /__/auth/handler.',
  };
};
