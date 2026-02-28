import { useEffect, useMemo, useState } from 'react';
import {
  onAuthChange,
  signOut,
  hasActiveFirebaseSession,
  handleSignInRedirectResult,
} from '@/services/auth/authService';
import { AuthUser, UserRole } from '@/types';
export type { UserRole };
import {
  createHandleLogout,
  getAuthBootstrapTimeoutMs,
  getE2EBootstrapUser,
  subscribeToResolvedAuthState,
  useInactivityLogout,
  useOnlineStatus,
} from '@/hooks/useAuthStateSupport';
import { clearAuthBootstrapPending } from '@/services/auth/authBootstrapState';

// UserRole and AuthUser are now imported from @/types

/**
 * Return type for the useAuthState hook.
 * Provides user authentication state, role information, and auth actions.
 */
export interface UseAuthStateReturn {
  /** Current authenticated user or null if not logged in */
  user: AuthUser | null;
  /** True while authentication state is being determined */
  authLoading: boolean;
  /** True if connected to Firebase (either real or anonymous auth) */
  isFirebaseConnected: boolean;
  /** Signs out the current user */
  handleLogout: (reason?: 'manual' | 'automatic') => Promise<void>;

  // Role-based properties
  /** Current user's role */
  role: UserRole;
  /** True if user has edit permissions (editor, admin, or nurse_hospital) */
  isEditor: boolean;
  /** True if user only has view permissions */
  isViewer: boolean;
  /** Alias for isEditor - true if user can modify data */
  canEdit: boolean;
}

/**
 * useAuthState Hook
 *
 * Central hook for managing authentication state throughout the application.
 * Supports Firebase auth plus anonymous signature-mode access.
 * Firebase connection status is monitored to enable/disable sync features.
 *
 * @returns Authentication state, user info, role flags, and auth actions
 */
export const useAuthState = (): UseAuthStateReturn => {
  const [e2eBootstrapUser] = useState<AuthUser | null>(() => getE2EBootstrapUser());
  const [user, setUser] = useState<AuthUser | null>(e2eBootstrapUser);
  const [authLoading, setAuthLoading] = useState(!e2eBootstrapUser);
  const [isFirebaseConnected, setIsFirebaseConnected] = useState(false);
  const isOnline = useOnlineStatus();
  const handleLogout = useMemo(() => createHandleLogout(user, signOut, setUser), [user]);

  useInactivityLogout(user, handleLogout);

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
  }, [e2eBootstrapUser]);

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
  }, [user, isOnline]);

  const role: UserRole = user?.role || 'viewer';
  const isEditor = role === 'editor' || role === 'admin' || role === 'nurse_hospital';
  const isViewer = !isEditor;
  const canEdit = isEditor;

  return {
    user,
    authLoading,
    isFirebaseConnected,
    handleLogout,
    role,
    isEditor,
    isViewer,
    canEdit,
  };
};
