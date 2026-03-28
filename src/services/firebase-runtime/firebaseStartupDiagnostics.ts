import type { FirebaseOptions } from 'firebase/app';
import {
  getFirebaseAuthConfigStatus,
  getFirebaseRuntimeConfigDiagnostics,
  type FirebaseRuntimeConfigDiagnostics,
} from '@/services/auth/firebaseAuthConfigPolicy';
import {
  getFirebaseStartupFailureMessage,
  getFirebaseStartupWarningCopy,
} from '@/services/auth/firebaseStartupUiPolicy';
import { mountFirebaseConfigWarning } from '@/services/auth/firebaseStartupWarningRenderer';
import { firebaseStartupDiagnosticsLogger } from '@/services/firebase-runtime/firebaseRuntimeLoggers';

export const warnWithFirebaseDiagnostics = (
  diagnostics: FirebaseRuntimeConfigDiagnostics,
  fallbackMessage?: string
) => {
  mountFirebaseConfigWarning(
    fallbackMessage || getFirebaseStartupFailureMessage(diagnostics),
    getFirebaseStartupWarningCopy(diagnostics)
  );
};

export const warnOnFirebaseAuthConfig = (config: FirebaseOptions) => {
  const authConfigStatus = getFirebaseAuthConfigStatus(config.authDomain);

  if (!authConfigStatus.hasAuthDomain) {
    firebaseStartupDiagnosticsLogger.warn(
      `[FirebaseConfig] ⚠️ ${authConfigStatus.supportSummary} ${authConfigStatus.supportAction}`
    );
    return;
  }

  if (!authConfigStatus.usesFirebaseHostedAuthDomain) {
    firebaseStartupDiagnosticsLogger.warn(
      `[FirebaseConfig] ⚠️ ${authConfigStatus.supportSummary} ${authConfigStatus.supportAction}`
    );
  }
};

export const validateFirebaseRuntimeConfig = (config: FirebaseOptions) => {
  const diagnostics = getFirebaseRuntimeConfigDiagnostics(config);
  if (diagnostics.hasBlockingIssue) {
    warnWithFirebaseDiagnostics(diagnostics);
    throw new Error(getFirebaseStartupFailureMessage(diagnostics));
  }
};

export const buildMissingFirebaseConfigDiagnostics = (): FirebaseRuntimeConfigDiagnostics => ({
  issues: [
    {
      field: 'apiKey',
      severity: 'blocking',
      summary: 'No fue posible obtener la configuración principal de Firebase.',
      action:
        'Revisa la función de configuración del entorno y confirma que pueda devolver las variables de Firebase.',
    },
  ],
  hasBlockingIssue: true,
  summary:
    'No se pudo cargar la configuración principal del sistema. Revisa la función de configuración y las variables de Firebase del entorno.',
  nextStep: 'Corrige la configuración del entorno y vuelve a intentar.',
});

export { mountFirebaseConfigWarning };
