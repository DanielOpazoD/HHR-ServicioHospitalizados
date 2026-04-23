import type { UseAuthStateReturn } from '@/hooks/useAuthState';
import type { NormalizeAuthOperationalStateInput } from '@/services/auth/authOperationalState';

export const buildNormalizedAuthOperationalStateInput = (
  authState: Pick<
    UseAuthStateReturn,
    | 'sessionState'
    | 'currentUser'
    | 'authorizedUser'
    | 'authLoading'
    | 'isFirebaseConnected'
    | 'remoteSyncStatus'
    | 'remoteSyncState'
    | 'authRuntime'
    | 'role'
    | 'handleLogout'
  >
): NormalizeAuthOperationalStateInput => ({
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
});
