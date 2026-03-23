/**
 * AuthContext
 * Manages authentication state and user roles across the application.
 * Uses useAuthState hook internally as the single source of truth.
 *
 * Supports Firebase auth, shared census and signature-mode access.
 * Roles: 'viewer' (read-only) | 'editor' (full access) | 'admin' (full access + admin features)
 */

import React, { createContext, useContext, ReactNode, useMemo } from 'react';
import { AuthUser, UserRole } from '@/types/auth';
export type { AuthUser, UserRole };
import { useAuthState } from '@/hooks/useAuthState';
import { isAuthenticatedAuthSessionState } from '@/services/auth/authSessionState';

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
  isSharedCensus: boolean;
  isUnauthorized: boolean;
  isEditor: boolean;
  isViewer: boolean;
  isFirebaseConnected: boolean;
  signOut: () => Promise<void>;
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

/**
 * AuthProvider wraps the application and provides authentication state.
 * Internally uses useAuthState hook - this ensures a single source of truth.
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // Use the hook as the single source of truth
  const authState = useAuthState();

  const value = useMemo<AuthContextType>(
    () => ({
      sessionState: authState.sessionState,
      authRuntime: authState.authRuntime,
      currentUser: authState.currentUser,
      authorizedUser: authState.authorizedUser,
      user: authState.currentUser,
      role: authState.role,
      isLoading: authState.authLoading,
      isAuthenticated: isAuthenticatedAuthSessionState(authState.sessionState),
      isAuthorizedSession: authState.sessionState.status === 'authorized',
      isAnonymousSignature: authState.sessionState.status === 'anonymous_signature',
      isSharedCensus: authState.sessionState.status === 'shared_census',
      isUnauthorized: authState.sessionState.status === 'unauthorized',
      isEditor: authState.isEditor,
      isViewer: authState.isViewer,
      isFirebaseConnected: authState.isFirebaseConnected,
      signOut: authState.handleLogout,
    }),
    [
      authState.sessionState,
      authState.authRuntime,
      authState.currentUser,
      authState.authorizedUser,
      authState.role,
      authState.authLoading,
      authState.isEditor,
      authState.isViewer,
      authState.isFirebaseConnected,
      authState.handleLogout,
    ]
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
