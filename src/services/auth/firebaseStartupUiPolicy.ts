import type { FirebaseRuntimeConfigDiagnostics } from '@/services/auth/firebaseAuthConfigPolicy';

export type FirebaseStartupWarningCopy = {
  title: string;
  summary: string;
  steps: string[];
  footnote: string;
};

const DEFAULT_WARNING_STEPS = [
  'Revisa en Netlify la variable VITE_FIREBASE_API_KEY (o VITE_FIREBASE_API_KEY_B64).',
  'Si usarás ingreso alternativo, confirma también VITE_FIREBASE_AUTH_DOMAIN.',
  'Vuelve a desplegar el sitio para aplicar los cambios.',
];

export const getFirebaseStartupWarningCopy = (
  diagnostics?: FirebaseRuntimeConfigDiagnostics
): FirebaseStartupWarningCopy => ({
  title: diagnostics?.hasBlockingIssue
    ? 'Configuración de acceso incompleta'
    : 'Configuración de acceso con advertencias',
  summary:
    diagnostics?.summary ||
    'La aplicación no puede iniciarse porque falta parte de la configuración de Firebase.',
  steps:
    diagnostics?.issues.map(issue => `${issue.summary} ${issue.action}`) || DEFAULT_WARNING_STEPS,
  footnote: diagnostics?.hasBlockingIssue
    ? 'Esta validación evita que la app quede cargando indefinidamente cuando la configuración del entorno está incompleta.'
    : 'La app puede seguir funcionando, pero algunas formas de ingreso o recuperación podrían no estar disponibles.',
});

export const getFirebaseStartupFailureMessage = (
  diagnostics?: FirebaseRuntimeConfigDiagnostics
): string =>
  diagnostics?.summary ||
  'No se pudo iniciar la conexión principal del sistema. Revisa la configuración de Firebase del entorno.';
