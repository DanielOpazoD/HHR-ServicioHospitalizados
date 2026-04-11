import React from 'react';
import ReactDOM from 'react-dom/client';
import App from '@/App';
import { bootstrapAppRuntime } from '@/app-shell/bootstrap/bootstrapAppRuntime';
import {
  installBootstrapRuntimeErrorListeners,
  recordBootstrapRuntimeError,
  recordBootstrapRuntimeResult,
} from '@/app-shell/bootstrap/bootstrapRuntimeTelemetry';
import { getFirebaseStartupFailureMessage } from '@/services/auth/firebaseStartupUiPolicy';
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

const renderApp = () => {
  bootLogger.info('Rendering application');
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
};

bootstrapAppRuntime()
  .then(result => {
    recordBootstrapRuntimeResult(result);

    if (result.status === 'reload') {
      return;
    }

    if (result.status === 'blocked') {
      mountFirebaseConfigWarning(result.message, result.warningCopy);
      return;
    }

    renderApp();
  })
  .catch(error => {
    recordBootstrapRuntimeError(error);
    bootLogger.error('Firebase initialization failed', error);
    mountFirebaseConfigWarning(getFirebaseStartupFailureMessage());
  })
  .finally(() => {
    // Keep the listeners active only through bootstrap to avoid mixing startup
    // incidents with later domain/runtime errors already captured elsewhere.
    detachBootstrapRuntimeErrorListeners();
  });
