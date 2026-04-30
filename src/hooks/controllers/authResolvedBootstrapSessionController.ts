import type { AuthSessionState } from '@/types/authSessionTypes';
import { defaultAuditPort } from '@/application/ports/auditPort';
import {
  clearAuthBootstrapPending,
  isAuthBootstrapPending,
  restoreAuthBootstrapReturnTo,
} from '@/services/auth/authBootstrapState';
import { clearRecentManualLogout } from '@/services/auth/authLogoutState';
import { isAuthenticatedAuthSessionState } from '@/services/auth/authSessionState';
import { markPerf } from '@/shared/runtime/perfAudit';
import { shouldLogSessionLogin } from '@/hooks/controllers/authBootstrapController';

interface ApplyResolvedBootstrapSessionStateDependencies {
  markPerf: (name: string, detail?: string) => void;
  isAuthBootstrapPending: () => boolean;
  restoreAuthBootstrapReturnTo: () => void;
  clearRecentManualLogout: () => void;
  clearAuthBootstrapPending: () => void;
  logUserLogin: (email: string) => void | Promise<void>;
  getSessionStorageItem: (key: string) => string | null;
  setSessionStorageItem: (key: string, value: string) => void;
}

const defaultApplyResolvedBootstrapSessionStateDependencies: ApplyResolvedBootstrapSessionStateDependencies =
  {
    markPerf,
    isAuthBootstrapPending,
    restoreAuthBootstrapReturnTo,
    clearRecentManualLogout,
    clearAuthBootstrapPending,
    logUserLogin: email => defaultAuditPort.logUserLogin(email),
    getSessionStorageItem: key =>
      typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(key) : null,
    setSessionStorageItem: (key, value) => {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(key, value);
      }
    },
  };

export const applyResolvedBootstrapSessionState = ({
  sessionState,
  setSessionState,
  setAuthLoading,
  dependencies = defaultApplyResolvedBootstrapSessionStateDependencies,
}: {
  sessionState: AuthSessionState;
  setSessionState: (sessionState: AuthSessionState) => void;
  setAuthLoading: (value: boolean) => void;
  dependencies?: ApplyResolvedBootstrapSessionStateDependencies;
}): void => {
  dependencies.markPerf('auth-bootstrap:apply-session', sessionState.status);
  if (dependencies.isAuthBootstrapPending()) {
    dependencies.restoreAuthBootstrapReturnTo();
  }
  if (
    isAuthenticatedAuthSessionState(sessionState) &&
    shouldLogSessionLogin({
      sessionState,
      hasLoggedThisSession: Boolean(dependencies.getSessionStorageItem('hhr_logged_this_session')),
    })
  ) {
    dependencies.clearRecentManualLogout();
    void dependencies.logUserLogin(sessionState.user.email as string);
    dependencies.setSessionStorageItem('hhr_logged_this_session', 'true');
  } else if (isAuthenticatedAuthSessionState(sessionState)) {
    dependencies.clearRecentManualLogout();
  }
  setSessionState(sessionState);
  setAuthLoading(false);
  dependencies.clearAuthBootstrapPending();
};
