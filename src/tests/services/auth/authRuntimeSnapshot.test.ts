import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockIsAuthBootstrapPending = vi.fn();
const mockGetAuthBootstrapPendingAgeMs = vi.fn();
const mockHasRecentManualLogout = vi.fn();

vi.mock('@/services/auth/authBootstrapState', () => ({
  isAuthBootstrapPending: () => mockIsAuthBootstrapPending(),
  getAuthBootstrapPendingAgeMs: () => mockGetAuthBootstrapPendingAgeMs(),
}));

vi.mock('@/services/auth/authLogoutState', () => ({
  hasRecentManualLogout: () => mockHasRecentManualLogout(),
}));

import { buildAuthRuntimeSnapshot } from '@/services/auth/authRuntimeSnapshot';

describe('authRuntimeSnapshot', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthBootstrapPending.mockReturnValue(false);
    mockGetAuthBootstrapPendingAgeMs.mockReturnValue(0);
    mockHasRecentManualLogout.mockReturnValue(false);
  });

  it('classifies pending bootstrap as recoverable with redirect budget profile', () => {
    mockIsAuthBootstrapPending.mockReturnValue(true);
    mockGetAuthBootstrapPendingAgeMs.mockReturnValue(12_000);

    const snapshot = buildAuthRuntimeSnapshot({
      sessionState: { status: 'authenticating', user: null },
      authLoading: true,
      isFirebaseConnected: false,
      isOnline: true,
    });

    expect(snapshot.runtimeState).toBe('recoverable');
    expect(snapshot.bootstrapPending).toBe(true);
    expect(snapshot.budgetProfile).toBe('redirect_pending');
    expect(snapshot.issues).toContain(
      'El bootstrap de autenticacion sigue pendiente y puede requerir recuperacion.'
    );
  });

  it('classifies unauthorized sessions with unauthorized runtime state', () => {
    const snapshot = buildAuthRuntimeSnapshot({
      sessionState: { status: 'unauthorized', user: null, reason: 'role_not_resolved' },
      authLoading: false,
      isFirebaseConnected: false,
      isOnline: true,
    });

    expect(snapshot.runtimeState).toBe('unauthorized');
    expect(snapshot.sessionStatus).toBe('unauthorized');
    expect(snapshot.issues).toContain(
      'La sesion actual no tiene autorizacion valida para el acceso solicitado.'
    );
  });

  it('classifies retryable auth errors without collapsing them into blocked', () => {
    const snapshot = buildAuthRuntimeSnapshot({
      sessionState: {
        status: 'auth_error',
        user: null,
        error: {
          message: 'Temporary failure',
          retryable: true,
        },
      },
      authLoading: false,
      isFirebaseConnected: false,
      isOnline: true,
    });

    expect(snapshot.runtimeState).toBe('retryable');
    expect(snapshot.issues).toContain('Temporary failure');
  });
});
