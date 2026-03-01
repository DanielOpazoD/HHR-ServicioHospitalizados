import type { FirebaseOptions } from 'firebase/app';

const FIREBASE_HOSTING_DOMAIN_SUFFIXES = ['.firebaseapp.com', '.web.app'] as const;

export type FirebaseRedirectSupportLevel = 'disabled' | 'warning' | 'ready';
export type FirebaseRuntimeConfigSeverity = 'warning' | 'blocking';

export interface FirebaseRuntimeConfigIssue {
  field: 'apiKey' | 'projectId' | 'appId' | 'authDomain';
  severity: FirebaseRuntimeConfigSeverity;
  summary: string;
  action: string;
}

export type FirebaseAuthConfigStatus = {
  authDomain: string;
  hasAuthDomain: boolean;
  usesFirebaseHostedAuthDomain: boolean;
  canAttemptRedirectAuth: boolean;
  redirectSupportLevel: FirebaseRedirectSupportLevel;
  redirectBlockedReason: string | null;
  supportSummary: string | null;
  supportAction: string | null;
};

export type FirebaseRuntimeConfigDiagnostics = {
  issues: FirebaseRuntimeConfigIssue[];
  hasBlockingIssue: boolean;
  summary: string;
  nextStep: string;
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
      redirectSupportLevel: 'disabled',
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
    redirectSupportLevel: usesFirebaseHostedAuthDomain ? 'ready' : 'warning',
    redirectBlockedReason: null,
    supportSummary: usesFirebaseHostedAuthDomain
      ? null
      : `El dominio de autenticación configurado (${authDomain}) no usa el hosting estándar de Firebase.`,
    supportAction: usesFirebaseHostedAuthDomain
      ? null
      : 'Si vas a usar acceso alternativo, confirma que el dominio tenga disponible /__/auth/handler.',
  };
};

export const getFirebaseRuntimeConfigDiagnostics = (
  config: Partial<FirebaseOptions>
): FirebaseRuntimeConfigDiagnostics => {
  const issues: FirebaseRuntimeConfigIssue[] = [];

  if (!String(config.apiKey || '').trim()) {
    issues.push({
      field: 'apiKey',
      severity: 'blocking',
      summary: 'Falta la clave principal de Firebase.',
      action: 'Configura VITE_FIREBASE_API_KEY o VITE_FIREBASE_API_KEY_B64.',
    });
  }

  if (!String(config.projectId || '').trim()) {
    issues.push({
      field: 'projectId',
      severity: 'blocking',
      summary: 'Falta el identificador del proyecto Firebase.',
      action: 'Configura VITE_FIREBASE_PROJECT_ID antes de iniciar la app.',
    });
  }

  if (!String(config.appId || '').trim()) {
    issues.push({
      field: 'appId',
      severity: 'blocking',
      summary: 'Falta el identificador de aplicación de Firebase.',
      action: 'Configura VITE_FIREBASE_APP_ID para completar la inicialización.',
    });
  }

  const authStatus = getFirebaseAuthConfigStatus(config.authDomain);
  if (!authStatus.hasAuthDomain) {
    issues.push({
      field: 'authDomain',
      severity: 'warning',
      summary: 'El acceso alternativo de Google no está disponible en este entorno.',
      action: 'Si necesitas acceso alternativo, configura VITE_FIREBASE_AUTH_DOMAIN.',
    });
  } else if (!authStatus.usesFirebaseHostedAuthDomain) {
    issues.push({
      field: 'authDomain',
      severity: 'warning',
      summary: `El dominio de autenticación (${authStatus.authDomain}) requiere validación manual.`,
      action:
        'Confirma que el dominio tenga disponible /__/auth/handler y esté autorizado en Firebase Auth.',
    });
  }

  const hasBlockingIssue = issues.some(issue => issue.severity === 'blocking');
  const summary = hasBlockingIssue
    ? 'La app no puede iniciar porque falta parte esencial de la configuración de Firebase.'
    : issues.length > 0
      ? 'La app puede iniciar, pero algunas rutas de acceso o recuperación quedarán limitadas.'
      : 'La configuración Firebase principal está completa.';
  const nextStep = hasBlockingIssue
    ? 'Completa las variables faltantes antes de volver a abrir la app.'
    : issues.length > 0
      ? 'Revisa las advertencias si necesitas acceso alternativo o recuperación avanzada.'
      : 'No se detectaron bloqueos de configuración.';

  return {
    issues,
    hasBlockingIssue,
    summary,
    nextStep,
  };
};
