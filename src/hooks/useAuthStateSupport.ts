import { useEffect, useState } from 'react';
import { AuthUser } from '@/types';
import { safeJsonParse } from '@/utils/jsonUtils';
import { ACTIVITY_EVENTS, SESSION_TIMEOUT_MS } from '@/constants/security';
import { logUserLogin, logUserLogout } from '@/services/admin/auditService';
import {
  clearAuthBootstrapPending,
  isAuthBootstrapPending,
} from '@/services/auth/authBootstrapState';
import {
  clearRecentManualLogout,
  hasRecentManualLogout,
  markRecentManualLogout,
} from '@/services/auth/authLogoutState';

export const getE2EBootstrapUser = (): AuthUser | null => {
  if (typeof window === 'undefined' || !window.__HHR_E2E_OVERRIDE__) {
    return null;
  }

  const storedUser = localStorage.getItem('hhr_e2e_bootstrap_user');
  return safeJsonParse<AuthUser | null>(storedUser, null);
};

export const useOnlineStatus = (): boolean => {
  const [isOnline, setIsOnline] = useState(window.navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

export const useFirebaseConnectionStatus = (
  user: AuthUser | null,
  isOnline: boolean,
  hasActiveFirebaseSession: () => boolean
): boolean => {
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);

  useEffect(() => {
    const checkConnection = () => {
      const hasSession = hasActiveFirebaseSession();
      setIsFirebaseConnected(isOnline && (hasSession || !!user));
    };

    checkConnection();
    const interval = setInterval(checkConnection, 1000);
    const timeout = setTimeout(() => clearInterval(interval), 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [user, isOnline, hasActiveFirebaseSession]);

  return isFirebaseConnected;
};

export const createHandleLogout =
  (
    user: AuthUser | null,
    signOut: () => Promise<void>,
    setUser: (user: AuthUser | null) => void
  ): ((reason?: 'manual' | 'automatic') => Promise<void>) =>
  async (reason: 'manual' | 'automatic' = 'manual') => {
    if (user?.email) {
      await logUserLogout(user.email, reason);
    }

    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem('hhr_logged_this_session');
    }
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem('hhr_e2e_bootstrap_user');
    }
    if (reason === 'manual') {
      markRecentManualLogout();
    }

    try {
      await signOut();
    } catch (error) {
      console.warn('[useAuthState] Firebase signOut failed (probably offline):', error);
    }

    setUser(null);
  };

export const useInactivityLogout = (
  user: AuthUser | null,
  handleLogout: (reason?: 'manual' | 'automatic') => Promise<void>
): void => {
  useEffect(() => {
    if (!user) return;

    let timeoutId: NodeJS.Timeout;

    const resetTimer = () => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        console.warn('[useAuthState] Logout due to inactivity');
        void handleLogout('automatic');
      }, SESSION_TIMEOUT_MS);
    };

    ACTIVITY_EVENTS.forEach(event => {
      window.addEventListener(event, resetTimer);
    });
    resetTimer();

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      ACTIVITY_EVENTS.forEach(event => {
        window.removeEventListener(event, resetTimer);
      });
    };
  }, [user, handleLogout]);
};

export const getAuthBootstrapTimeoutMs = (): number => {
  if (hasRecentManualLogout()) return 1500;
  if (!window.navigator.onLine) return 5000;
  return isAuthBootstrapPending() ? 45000 : 15000;
};

export const subscribeToResolvedAuthState = async ({
  handleSignInRedirectResult,
  onAuthChange,
  setUser,
  setAuthLoading,
}: {
  handleSignInRedirectResult: () => Promise<AuthUser | null>;
  onAuthChange: (callback: (user: AuthUser | null) => void | Promise<void>) => () => void;
  setUser: (user: AuthUser | null) => void;
  setAuthLoading: (value: boolean) => void;
}): Promise<() => void> => {
  try {
    const redirectUser = await handleSignInRedirectResult();
    if (redirectUser) {
      clearRecentManualLogout();
      setUser(redirectUser);
      setAuthLoading(false);
      clearAuthBootstrapPending();
    }
  } catch (error) {
    console.warn('[useAuthState] Redirect result check error:', error);
  }

  return onAuthChange(async authUser => {
    if (authUser) {
      clearRecentManualLogout();
      if (
        authUser.email &&
        typeof sessionStorage !== 'undefined' &&
        !sessionStorage.getItem('hhr_logged_this_session')
      ) {
        logUserLogin(authUser.email);
        sessionStorage.setItem('hhr_logged_this_session', 'true');
      }
      setUser(authUser);
    } else {
      if (hasRecentManualLogout()) {
        clearRecentManualLogout();
        clearAuthBootstrapPending();
        setUser(null);
        setAuthLoading(false);
        return;
      }
      if (isAuthBootstrapPending()) {
        return;
      }
      setUser(null);
    }

    clearAuthBootstrapPending();
    setAuthLoading(false);
  });
};

export const useResolvedAuthBootstrap = ({
  e2eBootstrapUser,
  handleSignInRedirectResult,
  onAuthChange,
  setUser,
  setAuthLoading,
}: {
  e2eBootstrapUser: AuthUser | null;
  handleSignInRedirectResult: () => Promise<AuthUser | null>;
  onAuthChange: (callback: (user: AuthUser | null) => void | Promise<void>) => () => void;
  setUser: (user: AuthUser | null) => void;
  setAuthLoading: (value: boolean) => void;
}): void => {
  useEffect(() => {
    if (e2eBootstrapUser) return;

    let unsubscribe: (() => void) | undefined;
    const timeoutMs = getAuthBootstrapTimeoutMs();
    const safetyTimeout = setTimeout(() => {
      console.warn(
        `[useAuthState] ⚠️ Auth initialization timed out (${timeoutMs}ms) - forcing load completion`
      );
      clearAuthBootstrapPending();
      setAuthLoading(false);
    }, timeoutMs);

    subscribeToResolvedAuthState({
      handleSignInRedirectResult,
      onAuthChange,
      setUser,
      setAuthLoading,
    }).then(unsub => {
      if (unsub) unsubscribe = unsub;
    });

    return () => {
      clearTimeout(safetyTimeout);
      if (unsubscribe) unsubscribe();
    };
  }, [e2eBootstrapUser, handleSignInRedirectResult, onAuthChange, setAuthLoading, setUser]);
};
