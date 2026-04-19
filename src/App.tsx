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
import {
  InitialLoadingScreen,
  shouldRenderInitialLoadingScreen,
} from '@/components/ui/InitialLoadingScreen';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { MedicalSignatureView } from '@/views/LazyViews';
import { AuthenticatedAppShell } from '@/app-shell/runtime/AuthenticatedAppShell';
import {
  clearRecentAuthenticatedSessionHint,
  hasRecentAuthenticatedSessionHint,
} from '@/services/auth/authStorageHints';
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

const RECENT_SESSION_LOGIN_SUPPRESSION_MS = 600;

function App() {
  const bootstrapState = useAppBootstrapState();
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';
  const [suppressLoginPage, setSuppressLoginPage] = React.useState(false);

  React.useLayoutEffect(() => {
    const shouldSuppress =
      bootstrapState.status === 'unauthenticated' && hasRecentAuthenticatedSessionHint();

    if (!shouldSuppress) {
      setSuppressLoginPage(false);
      return;
    }

    setSuppressLoginPage(true);
    const timeoutId = window.setTimeout(() => {
      clearRecentAuthenticatedSessionHint();
      setSuppressLoginPage(false);
    }, RECENT_SESSION_LOGIN_SUPPRESSION_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [bootstrapState.status]);

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
    // `/census` skips the pre-shell loader on purpose. Returning `null` here
    // lets the route wait quietly until the authenticated census shell can
    // render its own in-context loader with the preserved chrome titles.
    if (!shouldRenderInitialLoadingScreen(pathname)) {
      return null;
    }

    const preferLoginShell =
      bootstrapState.auth.sessionState.status === 'unauthenticated' &&
      !hasRecentAuthenticatedSessionHint();

    return <InitialLoadingScreen pathname={pathname} preferLoginShell={preferLoginShell} />;
  }

  if (bootstrapState.status === 'unauthenticated') {
    // Same-tab authenticated refreshes can transiently dip into
    // `unauthenticated` before Firebase finishes rehydrating. On `/census`
    // we keep that interval visually silent so we don't introduce a second
    // global loader before the module's own shell loader appears.
    if (suppressLoginPage && !shouldRenderInitialLoadingScreen(pathname)) {
      return null;
    }

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
