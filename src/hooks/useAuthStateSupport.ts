import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';
import { useEffect } from 'react';
import type { AuthSessionState } from '@/types/authSessionTypes';
import type { AuthUser } from '@/types/authRoleTypes';
import { defaultAuditPort } from '@/application/ports/auditPort';
import {
  clearAuthBootstrapPending,
  getAuthBootstrapPendingAgeMs,
  isAuthBootstrapPending,
  restoreAuthBootstrapReturnTo,
} from '@/services/auth/authBootstrapState';
import { clearRecentManualLogout, hasRecentManualLogout } from '@/services/auth/authLogoutState';
import {
  createAuthErrorSessionState,
  createUnauthenticatedAuthSessionState,
  isAuthenticatedAuthSessionState,
  toResolvedAuthSessionState,
} from '@/services/auth/authSessionState';
import { authStateLogger } from '@/hooks/hookLoggers';
import { recordOperationalOutcome } from '@/services/observability/operationalTelemetryOutcomeRecorder';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryRecorder';
import { resolveAuthBootstrapBudget } from '@/services/auth/authBootstrapBudgets';
import { hasActiveFirebaseSession } from '@/services/auth/authFallback';
import {
  clearGoogleLoginAttemptHint,
  hasPersistedFirebaseAuthHint,
  hasRecentGoogleLoginAttemptHint,
} from '@/services/auth/authStorageHints';
import { markPerf } from '@/shared/runtime/perfAudit';
import {
  buildBootstrapTimeoutAuthError,
  buildBootstrapTimeoutIssue,
  shouldAttemptAuthTimeoutRecovery,
  shouldDeferUnauthenticatedSessionState,
  shouldIgnoreTransientUnauthenticatedBootstrapEvent,
  shouldResolveAuthBootstrapImmediatelyAsUnauthenticated,
  shouldLogSessionLogin,
} from '@/hooks/controllers/authBootstrapController';
export {
  createHandleLogout,
  getAuthBootstrapTimeoutMs,
  getE2EBootstrapUser,
  useFirebaseConnectionStatus,
  useInactivityLogout,
  useOnlineStatus,
} from '@/hooks/useAuthStateSessionSupport';

const applyResolvedBootstrapSessionState = ({
  sessionState,
  setSessionState,
  setAuthLoading,
}: {
  sessionState: AuthSessionState;
  setSessionState: (sessionState: AuthSessionState) => void;
  setAuthLoading: (value: boolean) => void;
}): void => {
  markPerf('auth-bootstrap:apply-session', sessionState.status);
  if (isAuthBootstrapPending()) {
    restoreAuthBootstrapReturnTo();
  }
  if (
    isAuthenticatedAuthSessionState(sessionState) &&
    shouldLogSessionLogin({
      sessionState,
      hasLoggedThisSession:
        typeof sessionStorage !== 'undefined' &&
        Boolean(sessionStorage.getItem('hhr_logged_this_session')),
    })
  ) {
    clearRecentManualLogout();
    void defaultAuditPort.logUserLogin(sessionState.user.email as string);
    sessionStorage.setItem('hhr_logged_this_session', 'true');
  } else if (isAuthenticatedAuthSessionState(sessionState)) {
    clearRecentManualLogout();
  }
  setSessionState(sessionState);
  setAuthLoading(false);
  clearAuthBootstrapPending();
};

export const subscribeToResolvedAuthState = async ({
  resolveRedirectAuthSessionOutcome,
  resolveCurrentAuthSessionOutcome,
  onAuthSessionStateChange,
  resolveImmediatelyAsUnauthenticatedWhenDirectChecksAreEmpty,
  hasAuthRehydrationHint,
  setSessionState,
  setAuthLoading,
}: {
  resolveRedirectAuthSessionOutcome: () => Promise<ApplicationOutcome<AuthSessionState | null>>;
  resolveCurrentAuthSessionOutcome: () => Promise<ApplicationOutcome<AuthSessionState | null>>;
  onAuthSessionStateChange: (
    callback: (sessionState: AuthSessionState) => void | Promise<void>
  ) => () => void;
  resolveImmediatelyAsUnauthenticatedWhenDirectChecksAreEmpty: boolean;
  hasAuthRehydrationHint: boolean;
  setSessionState: (sessionState: AuthSessionState) => void;
  setAuthLoading: (value: boolean) => void;
}): Promise<() => void> => {
  let isBootstrapLoading = true;

  try {
    markPerf('auth-bootstrap:redirect-start');
    const redirectOutcome = await resolveRedirectAuthSessionOutcome();
    markPerf('auth-bootstrap:redirect-done', redirectOutcome.status);
    recordOperationalOutcome('auth', 'redirect_resolution', redirectOutcome, {
      allowSuccess: true,
    });
    const redirectSessionState = redirectOutcome.data;
    if (redirectSessionState) {
      applyResolvedBootstrapSessionState({
        sessionState: redirectSessionState,
        setSessionState,
        setAuthLoading,
      });
      isBootstrapLoading = false;
    } else {
      markPerf('auth-bootstrap:current-session-start');
      const currentSessionOutcome = await resolveCurrentAuthSessionOutcome();
      markPerf('auth-bootstrap:current-session-done', currentSessionOutcome.status);
      recordOperationalOutcome('auth', 'current_session_resolution', currentSessionOutcome, {
        allowSuccess: true,
      });
      if (currentSessionOutcome.data) {
        applyResolvedBootstrapSessionState({
          sessionState: currentSessionOutcome.data,
          setSessionState,
          setAuthLoading,
        });
        isBootstrapLoading = false;
      } else if (
        resolveImmediatelyAsUnauthenticatedWhenDirectChecksAreEmpty ||
        (!isAuthBootstrapPending() && !hasActiveFirebaseSession())
      ) {
        clearAuthBootstrapPending();
        setSessionState(createUnauthenticatedAuthSessionState());
        setAuthLoading(false);
        isBootstrapLoading = false;
      }
    }
  } catch (error) {
    authStateLogger.info('Redirect result check error', error);
    recordOperationalTelemetry({
      category: 'auth',
      operation: 'redirect_resolution_failure',
      status: 'degraded',
      runtimeState: 'recoverable',
      context: {
        isOnline: window.navigator.onLine,
        authBootstrapPending: isAuthBootstrapPending(),
        pendingAgeMs: getAuthBootstrapPendingAgeMs(),
      },
      issues: [error instanceof Error ? error.message : 'No se pudo revisar el redirect de auth.'],
    });
  }

  markPerf('auth-bootstrap:observer-subscribe');
  return onAuthSessionStateChange(async sessionState => {
    markPerf('auth-bootstrap:observer-event', sessionState.status);
    recordOperationalTelemetry(
      {
        category: 'auth',
        operation: 'session_state_change',
        status: sessionState.status === 'auth_error' ? 'failed' : 'success',
        context: {
          sessionStatus: sessionState.status,
        },
        issues:
          sessionState.status === 'auth_error' && sessionState.error.userSafeMessage
            ? [sessionState.error.userSafeMessage]
            : undefined,
      },
      { allowSuccess: true }
    );

    if (isAuthenticatedAuthSessionState(sessionState)) {
      applyResolvedBootstrapSessionState({
        sessionState,
        setSessionState,
        setAuthLoading,
      });
      isBootstrapLoading = false;
      return;
    } else {
      if (
        shouldIgnoreTransientUnauthenticatedBootstrapEvent({
          isBootstrapLoading,
          sessionState,
          hasRecentManualLogout: hasRecentManualLogout(),
          hasAuthRehydrationHint,
        })
      ) {
        authStateLogger.info(
          'Ignoring transient unauthenticated auth event while persistence rehydrates'
        );
        return;
      }

      if (hasRecentManualLogout()) {
        clearRecentManualLogout();
        clearAuthBootstrapPending();
        setSessionState(createUnauthenticatedAuthSessionState());
        setAuthLoading(false);
        isBootstrapLoading = false;
        return;
      }
      if (
        sessionState.status === 'unauthenticated' &&
        hasRecentGoogleLoginAttemptHint() &&
        !hasRecentManualLogout()
      ) {
        clearGoogleLoginAttemptHint();
        clearAuthBootstrapPending();
        setSessionState(createAuthErrorSessionState(buildBootstrapTimeoutAuthError()));
        setAuthLoading(false);
        isBootstrapLoading = false;
        return;
      }
      if (
        shouldDeferUnauthenticatedSessionState({
          sessionState,
          isAuthBootstrapPending: isAuthBootstrapPending(),
        })
      ) {
        return;
      }
      setSessionState(sessionState);
    }

    clearAuthBootstrapPending();
    setAuthLoading(false);
    isBootstrapLoading = false;
  });
};

export const useResolvedAuthBootstrap = ({
  e2eBootstrapUser,
  resolveRedirectAuthSessionOutcome,
  resolveCurrentAuthSessionOutcome,
  onAuthSessionStateChange,
  setSessionState,
  setAuthLoading,
}: {
  e2eBootstrapUser: AuthUser | null;
  resolveRedirectAuthSessionOutcome: () => Promise<ApplicationOutcome<AuthSessionState | null>>;
  resolveCurrentAuthSessionOutcome: () => Promise<ApplicationOutcome<AuthSessionState | null>>;
  onAuthSessionStateChange: (
    callback: (sessionState: AuthSessionState) => void | Promise<void>
  ) => () => void;
  setSessionState: (sessionState: AuthSessionState) => void;
  setAuthLoading: (value: boolean) => void;
}): void => {
  useEffect(() => {
    markPerf('auth-bootstrap:effect-start');
    if (e2eBootstrapUser) {
      setSessionState(toResolvedAuthSessionState(e2eBootstrapUser));
      setAuthLoading(false);
      return;
    }

    let unsubscribe: (() => void) | undefined;
    const hasPendingRedirect = isAuthBootstrapPending();
    const hasPersistedAuthRehydrationHint = hasPersistedFirebaseAuthHint();
    const canResolveImmediatelyAsUnauthenticatedAfterDirectChecks =
      shouldResolveAuthBootstrapImmediatelyAsUnauthenticated({
        hasPendingRedirect,
        hasAuthRehydrationHint: hasPersistedAuthRehydrationHint,
        hasActiveFirebaseSession: hasActiveFirebaseSession(),
      });

    const bootstrapBudget = resolveAuthBootstrapBudget({
      hasRecentManualLogout: hasRecentManualLogout(),
      isOnline: window.navigator.onLine,
      hasPendingRedirect,
    });
    const timeoutMs = bootstrapBudget.timeoutMs;
    let isBootstrapResolved = false;
    const safetyTimeout: ReturnType<typeof setTimeout> = setTimeout(() => {
      if (isBootstrapResolved) {
        return;
      }

      authStateLogger.info(
        `Auth initialization timed out (${timeoutMs}ms) - forcing load completion`,
        {
          isOnline: window.navigator.onLine,
          authBootstrapPending: isAuthBootstrapPending(),
        }
      );
      recordOperationalTelemetry({
        category: 'auth',
        operation: 'bootstrap_timeout',
        status: 'degraded',
        runtimeState: 'recoverable',
        context: {
          timeoutMs,
          budgetProfile: bootstrapBudget.profile,
          pendingAgeMs: getAuthBootstrapPendingAgeMs(),
          isOnline: window.navigator.onLine,
          authBootstrapPending: isAuthBootstrapPending(),
        },
        issues: [buildBootstrapTimeoutIssue()],
      });

      if (
        shouldAttemptAuthTimeoutRecovery({
          hasRecentManualLogout: hasRecentManualLogout(),
          hasAuthRehydrationHint: hasPersistedAuthRehydrationHint,
        })
      ) {
        void resolveCurrentAuthSessionOutcome()
          .then(timeoutRecoveryOutcome => {
            recordOperationalOutcome(
              'auth',
              'timeout_current_session_resolution',
              timeoutRecoveryOutcome,
              {
                allowSuccess: true,
              }
            );

            if (isBootstrapResolved) {
              return;
            }

            if (timeoutRecoveryOutcome.status === 'success' && timeoutRecoveryOutcome.data) {
              applyResolvedBootstrapSessionState({
                sessionState: timeoutRecoveryOutcome.data,
                setSessionState,
                setAuthLoading: setResolvedAuthLoading,
              });
              return;
            }

            clearAuthBootstrapPending();
            setSessionState(createAuthErrorSessionState(buildBootstrapTimeoutAuthError()));
            setResolvedAuthLoading(false);
          })
          .catch(error => {
            if (isBootstrapResolved) {
              return;
            }

            authStateLogger.warn('Auth timeout recovery resolution failed', error);
            clearAuthBootstrapPending();
            setSessionState(createAuthErrorSessionState(buildBootstrapTimeoutAuthError()));
            setResolvedAuthLoading(false);
          });
        return;
      }

      clearAuthBootstrapPending();
      setSessionState(createAuthErrorSessionState(buildBootstrapTimeoutAuthError()));
      setResolvedAuthLoading(false);
    }, timeoutMs);

    const markBootstrapResolved = () => {
      if (isBootstrapResolved) {
        return;
      }

      isBootstrapResolved = true;
      clearTimeout(safetyTimeout);
    };
    const setResolvedAuthLoading = (value: boolean) => {
      if (!value) {
        markPerf('auth-bootstrap:loading-false');
        markBootstrapResolved();
      }
      setAuthLoading(value);
    };

    subscribeToResolvedAuthState({
      resolveRedirectAuthSessionOutcome,
      resolveCurrentAuthSessionOutcome,
      onAuthSessionStateChange,
      resolveImmediatelyAsUnauthenticatedWhenDirectChecksAreEmpty:
        canResolveImmediatelyAsUnauthenticatedAfterDirectChecks,
      hasAuthRehydrationHint: hasPersistedAuthRehydrationHint,
      setSessionState,
      setAuthLoading: setResolvedAuthLoading,
    }).then(unsub => {
      if (unsub) unsubscribe = unsub;
    });

    return () => {
      markBootstrapResolved();
      if (unsubscribe) unsubscribe();
    };
  }, [
    e2eBootstrapUser,
    resolveRedirectAuthSessionOutcome,
    resolveCurrentAuthSessionOutcome,
    onAuthSessionStateChange,
    setAuthLoading,
    setSessionState,
  ]);
};
