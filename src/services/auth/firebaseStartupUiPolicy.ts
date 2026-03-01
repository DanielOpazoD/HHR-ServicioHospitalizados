export type FirebaseStartupWarningCopy = {
  title: string;
  summary: string;
  steps: string[];
  footnote: string;
};

export const getFirebaseStartupWarningCopy = (): FirebaseStartupWarningCopy => ({
  title: 'Configuración de acceso incompleta',
  summary: 'La aplicación no puede iniciarse porque falta parte de la configuración de Firebase.',
  steps: [
    'Revisa en Netlify la variable VITE_FIREBASE_API_KEY (o VITE_FIREBASE_API_KEY_B64).',
    'Si usarás ingreso alternativo, confirma también VITE_FIREBASE_AUTH_DOMAIN.',
    'Vuelve a desplegar el sitio para aplicar los cambios.',
  ],
  footnote:
    'Esta validación evita que la app quede cargando indefinidamente cuando la configuración del entorno está incompleta.',
});

export const getFirebaseStartupFailureMessage = (): string =>
  'No se pudo iniciar la conexión principal del sistema. Revisa la configuración de Firebase del entorno.';
