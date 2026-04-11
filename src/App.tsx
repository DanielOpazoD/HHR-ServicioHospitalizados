/**
 * App.tsx - Main Application Component
 *
 * Coordinates bootstrap state, authenticated runtime wiring, and global providers.
 */

import React from 'react';
import { LoginPage } from '@/features/auth';
import { GlobalErrorBoundary } from '@/components/shared/GlobalErrorBoundary';
import { VersionProvider } from '@/context/VersionContext';
import { VersionMismatchOverlay } from '@/components/shared/VersionMismatchOverlay';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { MedicalSignatureView } from '@/views/LazyViews';
import { lazyWithRetry } from '@/utils/lazyWithRetry';
import { AuditProvider, AuthProvider, UIProvider } from './context';
import { HospitalProvider } from './context/HospitalContext';
import { DefaultRepositoryProvider } from '@/services/RepositoryContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';
import { useAppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';

const AuthenticatedAppShell = lazyWithRetry(() =>
  import('@/app-shell/runtime/AuthenticatedAppShell').then(module => ({
    default: module.AuthenticatedAppShell,
  }))
);

const AppLoadingScreen = () => (
  <div className="min-h-screen bg-slate-100 flex items-center justify-center">
    <div className="animate-pulse text-medical-600 text-xl font-bold">Cargando...</div>
  </div>
);

const VersionedAppShell = ({ children }: { children: React.ReactNode }) => (
  <VersionProvider>
    <VersionMismatchOverlay />
    {children}
  </VersionProvider>
);

function App() {
  const bootstrapState = useAppBootstrapState();

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
    return <AppLoadingScreen />;
  }

  if (bootstrapState.status === 'unauthenticated') {
    return <LoginPage onLoginSuccess={() => {}} />;
  }

  return (
    <VersionedAppShell>
      <React.Suspense fallback={<ViewLoader />}>
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
