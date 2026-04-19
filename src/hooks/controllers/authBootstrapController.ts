import type { AuthSessionState } from '@/types/auth';

export const shouldIgnoreTransientUnauthenticatedBootstrapEvent = ({
  isBootstrapLoading,
  sessionState,
  hasRecentManualLogout,
  hasAuthRehydrationHint,
}: {
  isBootstrapLoading: boolean;
  sessionState: AuthSessionState;
  hasRecentManualLogout: boolean;
  hasAuthRehydrationHint: boolean;
}): boolean =>
  isBootstrapLoading &&
  sessionState.status === 'unauthenticated' &&
  !hasRecentManualLogout &&
  hasAuthRehydrationHint;

export const shouldDeferUnauthenticatedSessionState = ({
  sessionState,
  isAuthBootstrapPending,
}: {
  sessionState: AuthSessionState;
  isAuthBootstrapPending: boolean;
}): boolean => isAuthBootstrapPending && sessionState.status === 'unauthenticated';

export const shouldAttemptAuthTimeoutRecovery = ({
  hasRecentManualLogout,
  hasAuthRehydrationHint,
}: {
  hasRecentManualLogout: boolean;
  hasAuthRehydrationHint: boolean;
}): boolean => !hasRecentManualLogout && hasAuthRehydrationHint;

export const shouldResolveAuthBootstrapImmediatelyAsUnauthenticated = ({
  hasPendingRedirect,
  hasAuthRehydrationHint,
  hasActiveFirebaseSession,
}: {
  hasPendingRedirect: boolean;
  hasAuthRehydrationHint: boolean;
  hasActiveFirebaseSession: boolean;
}): boolean => !hasPendingRedirect && !hasAuthRehydrationHint && !hasActiveFirebaseSession;

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
