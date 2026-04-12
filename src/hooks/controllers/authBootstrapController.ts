import type { AuthSessionState } from '@/types/auth';

export const shouldIgnoreTransientUnauthenticatedBootstrapEvent = ({
  isBootstrapLoading,
  sessionState,
  hasRecentManualLogout,
  hasPersistedFirebaseAuthHint,
}: {
  isBootstrapLoading: boolean;
  sessionState: AuthSessionState;
  hasRecentManualLogout: boolean;
  hasPersistedFirebaseAuthHint: boolean;
}): boolean =>
  isBootstrapLoading &&
  sessionState.status === 'unauthenticated' &&
  !hasRecentManualLogout &&
  hasPersistedFirebaseAuthHint;

export const shouldDeferUnauthenticatedSessionState = ({
  sessionState,
  isAuthBootstrapPending,
}: {
  sessionState: AuthSessionState;
  isAuthBootstrapPending: boolean;
}): boolean => isAuthBootstrapPending && sessionState.status === 'unauthenticated';

export const shouldAttemptAuthTimeoutRecovery = ({
  hasRecentManualLogout,
  hasPersistedFirebaseAuthHint,
}: {
  hasRecentManualLogout: boolean;
  hasPersistedFirebaseAuthHint: boolean;
}): boolean => !hasRecentManualLogout && hasPersistedFirebaseAuthHint;

export const shouldLogSessionLogin = ({
  sessionState,
  hasLoggedThisSession,
}: {
  sessionState: AuthSessionState;
  hasLoggedThisSession: boolean;
}): boolean =>
  sessionState.status === 'authorized' && Boolean(sessionState.user.email) && !hasLoggedThisSession;

export const buildBootstrapTimeoutIssue = (): string =>
  'La inicializacion de autenticacion excedio el tiempo esperado.';
