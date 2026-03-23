import { useMemo, useState } from 'react';
import { onAuthSessionStateChange, signOut, hasActiveFirebaseSession } from '@/services/auth';
import { executeRedirectAuthResolution } from '@/application/auth';
import { AuthSessionState, AuthUser, UserRole } from '@/types/auth';
export type { AuthSessionState, UserRole };
import { canEditAnyAppModule } from '@/shared/access/operationalAccessPolicy';
import {
  createHandleLogout,
  getE2EBootstrapUser,
  useFirebaseConnectionStatus,
  useInactivityLogout,
  useOnlineStatus,
  useResolvedAuthBootstrap,
} from '@/hooks/useAuthStateSupport';
import { hasRecentManualLogout } from '@/services/auth/authLogoutState';
import {
  createAuthenticatingAuthSessionState,
  createUnauthenticatedAuthSessionState,
  getAuthSessionStateUser,
  isAuthenticatedAuthSessionState,
  toResolvedAuthSessionState,
} from '@/services/auth/authSessionState';
import {
  buildAuthRuntimeSnapshot,
  type AuthRuntimeSnapshot,
} from '@/services/auth/authRuntimeSnapshot';

/**
 * Return type for the useAuthState hook.
 * Provides user authentication state, role information, and auth actions.
 */
export interface UseAuthStateReturn {
  /** Canonical authentication session state */
  sessionState: AuthSessionState;
  /** Current actor user derived from session state */
  currentUser: AuthUser | null;
  /** Current fully authorized user; excludes anonymous/shared access */
  authorizedUser: AuthUser | null;
  /** @deprecated Prefer currentUser or authorizedUser */
  user: AuthUser | null;
  /** True while authentication state is being determined */
  authLoading: boolean;
  /** True if connected to Firebase (either real or anonymous auth) */
  isFirebaseConnected: boolean;
  /** Snapshot operativo de auth bootstrap y sesión */
  authRuntime: AuthRuntimeSnapshot;
  /** Signs out the current user */
  handleLogout: (reason?: 'manual' | 'automatic') => Promise<void>;

  // Role-based properties
  /** Current user's role */
  role: UserRole;
  /** True if user has edit permissions in at least one module */
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
  const [sessionState, setSessionState] = useState<AuthSessionState>(() => {
    if (e2eBootstrapUser) {
      return toResolvedAuthSessionState(e2eBootstrapUser);
    }

    return hasRecentManualLogout() && !hasActiveFirebaseSession()
      ? createUnauthenticatedAuthSessionState()
      : createAuthenticatingAuthSessionState();
  });
  const currentUser = getAuthSessionStateUser(sessionState);
  const authorizedUser =
    isAuthenticatedAuthSessionState(sessionState) && sessionState.status === 'authorized'
      ? sessionState.user
      : null;
  const [authLoading, setAuthLoading] = useState(
    !e2eBootstrapUser && !(hasRecentManualLogout() && !hasActiveFirebaseSession())
  );
  const isOnline = useOnlineStatus();
  const handleLogout = useMemo(
    () => createHandleLogout(currentUser, signOut, setSessionState),
    [currentUser]
  );
  const isFirebaseConnected = useFirebaseConnectionStatus(
    currentUser,
    isOnline,
    hasActiveFirebaseSession
  );

  useInactivityLogout(currentUser, handleLogout);
  useResolvedAuthBootstrap({
    e2eBootstrapUser,
    resolveRedirectAuthSessionOutcome: executeRedirectAuthResolution,
    onAuthSessionStateChange,
    setSessionState,
    setAuthLoading,
  });

  const role: UserRole = currentUser?.role || 'viewer';
  const isEditor = canEditAnyAppModule(role);
  const isViewer = !isEditor;
  const canEdit = isEditor;
  const authRuntime = useMemo(
    () =>
      buildAuthRuntimeSnapshot({
        sessionState,
        authLoading,
        isFirebaseConnected,
        isOnline,
      }),
    [sessionState, authLoading, isFirebaseConnected, isOnline]
  );

  return {
    sessionState,
    currentUser,
    authorizedUser,
    user: currentUser,
    authLoading,
    isFirebaseConnected,
    authRuntime,
    handleLogout,
    role,
    isEditor,
    isViewer,
    canEdit,
  };
};
