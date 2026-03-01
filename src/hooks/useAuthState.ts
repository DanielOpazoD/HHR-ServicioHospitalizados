import { useMemo, useState } from 'react';
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
  getE2EBootstrapUser,
  useFirebaseConnectionStatus,
  useInactivityLogout,
  useOnlineStatus,
  useResolvedAuthBootstrap,
} from '@/hooks/useAuthStateSupport';
import { hasRecentManualLogout } from '@/services/auth/authLogoutState';

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
  const [authLoading, setAuthLoading] = useState(
    !e2eBootstrapUser && !(hasRecentManualLogout() && !hasActiveFirebaseSession())
  );
  const isOnline = useOnlineStatus();
  const handleLogout = useMemo(() => createHandleLogout(user, signOut, setUser), [user]);
  const isFirebaseConnected = useFirebaseConnectionStatus(user, isOnline, hasActiveFirebaseSession);

  useInactivityLogout(user, handleLogout);
  useResolvedAuthBootstrap({
    e2eBootstrapUser,
    handleSignInRedirectResult,
    onAuthChange,
    setUser,
    setAuthLoading,
  });

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
