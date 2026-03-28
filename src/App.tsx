/**
 * App.tsx - Main Application Component
 *
 * Coordinates bootstrap state, authenticated runtime wiring, and global providers.
 */

import React from 'react';
import { LoginPage } from '@/features/auth';
import { GlobalErrorBoundary } from '@/components/shared/GlobalErrorBoundary';
import { AppContent } from '@/components/layout/AppContent';
import { CensusProvider } from '@/context/CensusContext';
import { VersionProvider } from '@/context/VersionContext';
import { VersionMismatchOverlay } from '@/components/shared/VersionMismatchOverlay';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { MedicalSignatureView } from '@/views/LazyViews';
import { AuditProvider, AuthProvider, UIProvider } from './context';
import { HospitalProvider } from './context/HospitalContext';
import { RepositoryProvider, defaultRepositories } from '@/services/RepositoryContext';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/config/queryClient';
import {
  useAppBootstrapState,
  type AppAuthenticatedDateNavigation,
} from '@/app-shell/bootstrap/useAppBootstrapState';
import { useAuthenticatedAppRuntime } from '@/app-shell/runtime/useAuthenticatedAppRuntime';

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

interface AuthenticatedAppShellProps {
  auth: Extract<ReturnType<typeof useAppBootstrapState>, { status: 'authenticated' }>['auth'];
  dateNav: AppAuthenticatedDateNavigation;
}

const AuthenticatedAppShell = ({ auth, dateNav }: AuthenticatedAppShellProps) => {
  const { censusContextValue, ui } = useAuthenticatedAppRuntime({ auth, dateNav });

  return (
    <CensusProvider value={censusContextValue}>
      <AppContent ui={ui} />
    </CensusProvider>
  );
};

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
        <RepositoryProvider value={defaultRepositories}>
          <HospitalProvider>
            <UIProvider>
              <AuditProvider userId="anon">
                <AppWithErrorBoundary />
              </AuditProvider>
            </UIProvider>
          </HospitalProvider>
        </RepositoryProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
