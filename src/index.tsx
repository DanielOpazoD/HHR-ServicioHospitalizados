import React from 'react';
import ReactDOM from 'react-dom/client';
import { bootstrapAppRuntime } from '@/app-shell/bootstrap/bootstrapAppRuntime';
import {
  installBootstrapRuntimeErrorListeners,
  recordBootstrapRuntimeError,
  recordBootstrapRuntimeResult,
} from '@/app-shell/bootstrap/bootstrapRuntimeTelemetry';
import {
  getFirebaseStartupFailureMessage,
  type FirebaseStartupWarningCopy,
} from '@/services/auth/firebaseStartupUiPolicy';
import { InitialLoadingScreen } from '@/components/ui/InitialLoadingScreen';
import { hasActiveFirebaseSession } from '@/services/auth/authFallback';
import {
  hasPersistedFirebaseAuthHint,
  hasRecentAuthenticatedSessionHint,
} from '@/services/auth/authStorageHints';
import { resolvePreMountLoadingScreenDecision } from '@/app-shell/bootstrap/appShellLoadingPolicy';
import { mountFirebaseConfigWarning } from '@/services/firebase-runtime/firebaseStartupDiagnostics';
import { createScopedLogger } from '@/services/utils/loggerScope';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
const bootLogger = createScopedLogger('Bootstrap');
const detachBootstrapRuntimeErrorListeners =
  typeof window !== 'undefined' ? installBootstrapRuntimeErrorListeners() : () => {};
const APP_SHELL_LOAD_WARNING_COPY: FirebaseStartupWarningCopy = {
  title: 'No se pudo completar el arranque',
  summary:
    'La app no logró cargar una parte crítica de la interfaz después de preparar el runtime inicial.',
  steps: [
    'Recarga la página para forzar la descarga del bundle actualizado.',
    'Si el problema persiste, limpia la caché del sitio y vuelve a intentar.',
    'Si falla en varios navegadores, revisa primero el smoke de preview y los chunks críticos del build.',
  ],
  footnote:
    'Este aviso apunta al bundle de interfaz o a la caché del navegador, no a una falta confirmada de variables Firebase.',
};

const isAppShellLoadFailure = (error: unknown): boolean => {
  const message =
    error instanceof Error
      ? error.message
      : error && typeof error === 'object' && 'message' in error
        ? String(error.message)
        : String(error);
  return /chunkloaderror|failed to fetch dynamically imported module|cannot access '.+' before initialization/i.test(
    message
  );
};

const renderBootstrapLoadingScreen = () => {
  const loadingScreenDecision = resolvePreMountLoadingScreenDecision({
    pathname: window.location.pathname,
    hasRecentAuthenticatedSessionHint: hasRecentAuthenticatedSessionHint(),
    hasPersistedFirebaseAuthHint: hasPersistedFirebaseAuthHint(),
    hasActiveFirebaseSession: hasActiveFirebaseSession(),
  });

  if (!loadingScreenDecision.shouldRender) {
    return;
  }

  root.render(
    <React.StrictMode>
      <InitialLoadingScreen preferLoginShell={loadingScreenDecision.preferLoginShell} />
    </React.StrictMode>
  );
};

const renderApp = async () => {
  bootLogger.info('Rendering application');
  const { default: App } = await import('@/App');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

renderBootstrapLoadingScreen();

bootstrapAppRuntime()
  .then(async result => {
    recordBootstrapRuntimeResult(result);

    if (result.status === 'reload') {
      return;
    }

    if (result.status === 'blocked') {
      mountFirebaseConfigWarning(result.message, result.warningCopy);
      return;
    }

    await renderApp();
  })
  .catch(error => {
    recordBootstrapRuntimeError(error);
    bootLogger.error('Firebase initialization failed', error);
    if (isAppShellLoadFailure(error)) {
      mountFirebaseConfigWarning(
        'No se pudo cargar una parte crítica de la interfaz.',
        APP_SHELL_LOAD_WARNING_COPY
      );
      return;
    }

    mountFirebaseConfigWarning(getFirebaseStartupFailureMessage());
  })
  .finally(() => {
    // Keep the listeners active only through bootstrap to avoid mixing startup
    // incidents with later domain/runtime errors already captured elsewhere.
    detachBootstrapRuntimeErrorListeners();
  });
