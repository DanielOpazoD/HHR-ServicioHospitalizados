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
import { MedicalSignatureView } from '@/views/LazyViews';
import { AuthenticatedAppShell } from '@/app-shell/runtime/AuthenticatedAppShell';
import { resolveRuntimeLoadingScreenMode } from '@/app-shell/bootstrap/appShellLoadingPolicy';
import { AuditProvider, AuthProvider, UIProvider } from './context';
import { HospitalProvider } from './context/HospitalContext';
import { DefaultRepositoryProvider } from '@/services/RepositoryContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';
import { useAppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';

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
      <AuthenticatedAppShell auth={bootstrapState.auth} dateNav={bootstrapState.dateNav} />
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
