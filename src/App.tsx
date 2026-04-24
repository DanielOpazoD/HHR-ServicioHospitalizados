/**
 * App.tsx - Main Application Component
 *
 * Coordinates bootstrap state, authenticated runtime wiring, and global providers.
 */

import React from 'react';
import { LoginPage } from '@/features/auth/public';
import { GlobalErrorBoundary } from '@/components/shared/GlobalErrorBoundary';
import { VersionProvider } from '@/context/VersionContext';
import { VersionMismatchOverlay } from '@/components/shared/VersionMismatchOverlay';
import { InitialLoadingScreen } from '@/components/ui/InitialLoadingScreen';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { BootstrapRouteChrome } from '@/app-shell/bootstrap/BootstrapCensusChrome';
import { MedicalSignatureView } from '@/views/LazyViews';
import { resolveRuntimeLoadingScreenMode } from '@/app-shell/bootstrap/appShellLoadingPolicy';
import { AuditProvider } from '@/context/AuditContext';
import { AuthProvider } from '@/context/AuthContext';
import { UIProvider } from '@/context/UIContext';
import { HospitalProvider } from './context/HospitalContext';
import { DefaultRepositoryProvider } from '@/services/RepositoryContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';
import { useAppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';
import { lazyWithRetry } from '@/utils/lazyWithRetry';

const AuthenticatedAppShell = lazyWithRetry(() =>
  import('@/app-shell/runtime/AuthenticatedAppShell').then(module => ({
    default: module.AuthenticatedAppShell,
  }))
);

const VersionedAppShell = ({ children }: { children: React.ReactNode }) => (
  <VersionProvider>
    <VersionMismatchOverlay />
    {children}
  </VersionProvider>
);

function App() {
  const bootstrapState = useAppBootstrapState();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const loadingScreenMode =
    bootstrapState.status === 'loading'
      ? resolveRuntimeLoadingScreenMode({
          pathname,
          bootstrapState,
        })
      : null;

  if (bootstrapState.status === 'signature_mode') {
    return (
      <VersionedAppShell>
        <React.Suspense fallback={<ViewLoader />}>
          <MedicalSignatureView />
        </React.Suspense>
      </VersionedAppShell>
    );
  }

  if (bootstrapState.status === 'loading') {
    if (loadingScreenMode === 'bootstrap-route-chrome') {
      return <BootstrapRouteChrome />;
    }

    if (loadingScreenMode === 'silent') {
      return null;
    }

    return (
      <InitialLoadingScreen
        pathname={pathname}
        preferLoginShell={loadingScreenMode === 'login-shell'}
      />
    );
  }

  if (bootstrapState.status === 'unauthenticated') {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  return (
    <VersionedAppShell>
      <React.Suspense fallback={<BootstrapRouteChrome />}>
        <AuthenticatedAppShell auth={bootstrapState.auth} dateNav={bootstrapState.dateNav} />
      </React.Suspense>
    </VersionedAppShell>
  );
}

const AppWithErrorBoundary = () => {
  return (
    <GlobalErrorBoundary>
      <App />
    </GlobalErrorBoundary>
  );
};

export default function ProvidedApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <DefaultRepositoryProvider>
          <HospitalProvider>
            <UIProvider>
              <AuditProvider userId="anon">
                <AppWithErrorBoundary />
              </AuditProvider>
            </UIProvider>
          </HospitalProvider>
        </DefaultRepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
