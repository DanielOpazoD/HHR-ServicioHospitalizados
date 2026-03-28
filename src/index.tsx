import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import App from '@/App';
import { firebaseReady, mountConfigWarning } from '@/firebaseConfig';
import { queryClient } from '@/config/queryClient';
import { GlobalErrorBoundary } from '@/components/shared/GlobalErrorBoundary';
import { getFirebaseStartupFailureMessage } from '@/services/auth/firebaseStartupUiPolicy';
import { createScopedLogger } from '@/services/utils/loggerScope';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Could not find root element to mount to');
}

const root = ReactDOM.createRoot(rootElement);
const bootLogger = createScopedLogger('Bootstrap');

const clearLocalServiceWorkers = async (): Promise<void> => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return;
  }

  const isLocalHost =
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '0.0.0.0';

  if (!isLocalHost) {
    return;
  }

  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map(registration => registration.unregister()));
  } catch (error) {
    bootLogger.warn('Could not unregister local service workers', error);
  }
};

const renderApp = () => {
  bootLogger.info('Rendering application');
  root.render(
    <React.StrictMode>
      <GlobalErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </GlobalErrorBoundary>
    </React.StrictMode>
  );
};

clearLocalServiceWorkers()
  .finally(() => firebaseReady.then(renderApp))
  .catch(error => {
    bootLogger.error('Firebase initialization failed', error);
    mountConfigWarning(getFirebaseStartupFailureMessage());
  });
