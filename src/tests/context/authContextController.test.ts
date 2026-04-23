import { describe, expect, it, vi } from 'vitest';
import { buildNormalizedAuthOperationalStateInput } from '@/context/authContextController';

describe('authContextController', () => {
  it('maps useAuthState output into normalized auth operational input', () => {
    const handleLogout = vi.fn();
    const authState: Parameters<typeof buildNormalizedAuthOperationalStateInput>[0] = {
      sessionState: { status: 'unauthenticated', user: null },
      currentUser: null,
      authorizedUser: null,
      authLoading: false,
      isFirebaseConnected: true,
      remoteSyncStatus: 'ready',
      remoteSyncState: { mode: 'enabled', reason: 'ready' },
      authRuntime: {
        sessionStatus: 'unauthenticated',
        authLoading: false,
        isFirebaseConnected: true,
        isOnline: true,
        bootstrapPending: false,
        pendingAgeMs: 0,
        budgetProfile: 'default',
        timeoutMs: 0,
        runtimeState: 'ok',
        issues: [],
      },
      role: 'admin',
      handleLogout,
    };

    expect(buildNormalizedAuthOperationalStateInput(authState)).toEqual({
      sessionState: authState.sessionState,
      currentUser: null,
      authorizedUser: null,
      authLoading: false,
      isFirebaseConnected: true,
      remoteSyncStatus: 'ready',
      remoteSyncState: { mode: 'enabled', reason: 'ready' },
      authRuntime: authState.authRuntime,
      role: 'admin',
      handleLogout,
    });
  });
});
