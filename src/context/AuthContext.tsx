/**
 * AuthContext
 * Manages authentication state and user roles across the application.
 * Uses useAuthState hook internally as the single source of truth.
 *
 * Supports Firebase auth and signature-mode access.
 * Roles: 'viewer' (read-only) | 'editor' (full access) | 'admin' (full access + admin features)
 */

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { AuthUser, UserRole } from '@/types/auth';
export type { AuthUser, UserRole };
import { useAuthState } from '@/hooks/useAuthState';
import { isAuthenticatedAuthSessionState } from '@/services/auth/authSessionState';
import {
  resolveNormalizedAuthOperationalState,
  type NormalizedAuthOperationalState,
} from '@/services/auth/authOperationalState';

// ============================================================================
// Types
// ============================================================================

export interface AuthContextType {
  sessionState: ReturnType<typeof useAuthState>['sessionState'];
  authRuntime: ReturnType<typeof useAuthState>['authRuntime'];
  currentUser: AuthUser | null;
  authorizedUser: AuthUser | null;
  /** @deprecated Prefer currentUser or authorizedUser */
  user: AuthUser | null;
  role: UserRole;
  isLoading: boolean;
  isAuthenticated: boolean;
  isAuthorizedSession: boolean;
  isAnonymousSignature: boolean;
  isUnauthorized: boolean;
  isEditor: boolean;
  isViewer: boolean;
  isFirebaseConnected: boolean;
  remoteSyncStatus: ReturnType<typeof useAuthState>['remoteSyncStatus'];
  remoteSyncState: ReturnType<typeof useAuthState>['remoteSyncState'];
  signOut: (reason?: 'manual' | 'automatic') => Promise<void>;
}

// ============================================================================
// Context
// ============================================================================

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ============================================================================
// Provider
// ============================================================================

interface AuthProviderProps {
  children: ReactNode;
}

export const buildAuthContextValue = (
  normalizedAuthState: NormalizedAuthOperationalState
): AuthContextType => ({
  sessionState: normalizedAuthState.sessionState,
  authRuntime: normalizedAuthState.authRuntime,
  currentUser: normalizedAuthState.currentUser,
  authorizedUser: normalizedAuthState.authorizedUser,
  user: normalizedAuthState.currentUser,
  role: normalizedAuthState.role,
  isLoading: normalizedAuthState.authLoading,
  isAuthenticated: isAuthenticatedAuthSessionState(normalizedAuthState.sessionState),
  isAuthorizedSession: normalizedAuthState.sessionState.status === 'authorized',
  isAnonymousSignature: normalizedAuthState.sessionState.status === 'anonymous_signature',
  isUnauthorized: normalizedAuthState.sessionState.status === 'unauthorized',
  isEditor: normalizedAuthState.isEditor,
  isViewer: normalizedAuthState.isViewer,
  isFirebaseConnected: normalizedAuthState.isFirebaseConnected,
  remoteSyncStatus: normalizedAuthState.remoteSyncStatus,
  remoteSyncState: normalizedAuthState.remoteSyncState,
  signOut: normalizedAuthState.handleLogout,
});

/**
 * AuthProvider wraps the application and provides authentication state.
 * Internally uses useAuthState hook - this ensures a single source of truth.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use the hook as the single source of truth
  const authState = useAuthState();
  const normalizedAuthState = useMemo(
    () =>
      resolveNormalizedAuthOperationalState({
        sessionState: authState.sessionState,
        currentUser: authState.currentUser,
        authorizedUser: authState.authorizedUser,
        authLoading: authState.authLoading,
        isFirebaseConnected: authState.isFirebaseConnected,
        remoteSyncStatus: authState.remoteSyncStatus,
        remoteSyncState: authState.remoteSyncState,
        authRuntime: authState.authRuntime,
        role: authState.role,
        handleLogout: authState.handleLogout,
      }),
    [
      authState.sessionState,
      authState.currentUser,
      authState.authorizedUser,
      authState.authLoading,
      authState.isFirebaseConnected,
      authState.remoteSyncStatus,
      authState.remoteSyncState,
      authState.authRuntime,
      authState.role,
      authState.handleLogout,
    ]
  );

  const value = useMemo<AuthContextType>(
    () => buildAuthContextValue(normalizedAuthState),
    [normalizedAuthState]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// ============================================================================
// Hooks
// ============================================================================

/**
 * Hook to access authentication context.
 * Must be used within an AuthProvider.
 */
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

/**
 * Convenience hook to check if user can edit.
 * @returns true if user has edit permissions
 */
export const useCanEdit = (): boolean => {
  const { isEditor } = useAuth();
  return isEditor;
};
