import { describe, expect, it } from 'vitest';
import { buildAuthRemoteSyncState } from '@/services/auth/authRemoteSyncState';

describe('authRemoteSyncState', () => {
  it('forces local_only when the E2E runtime requests local sync only', () => {
    localStorage.setItem('hhr_e2e_force_local_only_sync', 'true');

    expect(
      buildAuthRemoteSyncState({
        sessionState: {
          status: 'authorized',
          user: {
            uid: 'u1',
            email: 'admin@hhr.cl',
            displayName: 'Admin',
            role: 'admin',
          },
        },
        authLoading: false,
        isFirebaseConnected: true,
        isOnline: true,
      })
    ).toEqual({
      mode: 'local_only',
      reason: 'manual_override',
    });

    localStorage.removeItem('hhr_e2e_force_local_only_sync');
  });

  it('returns auth_loading while bootstrap is still resolving', () => {
    expect(
      buildAuthRemoteSyncState({
        sessionState: { status: 'authenticating', user: null },
        authLoading: true,
        isFirebaseConnected: false,
        isOnline: true,
      })
    ).toEqual({
      mode: 'bootstrapping',
      reason: 'auth_loading',
    });
  });

  it('returns auth_connecting when a valid session exists but firebase runtime is not ready yet', () => {
    expect(
      buildAuthRemoteSyncState({
        sessionState: {
          status: 'authorized',
          user: {
            uid: 'u1',
            email: 'admin@hhr.cl',
            displayName: 'Admin',
            role: 'admin',
          },
        },
        authLoading: false,
        isFirebaseConnected: false,
        isOnline: true,
      })
    ).toEqual({
      mode: 'bootstrapping',
      reason: 'auth_connecting',
    });
  });

  it('returns offline local_only when the browser has no network', () => {
    expect(
      buildAuthRemoteSyncState({
        sessionState: {
          status: 'authorized',
          user: {
            uid: 'u1',
            email: 'admin@hhr.cl',
            displayName: 'Admin',
            role: 'admin',
          },
        },
        authLoading: false,
        isFirebaseConnected: false,
        isOnline: false,
      })
    ).toEqual({
      mode: 'local_only',
      reason: 'offline',
    });
  });

  it('returns runtime_unavailable when auth resolution itself is degraded', () => {
    expect(
      buildAuthRemoteSyncState({
        sessionState: {
          status: 'auth_error',
          user: null,
          error: {
            message: 'Auth failed',
            retryable: true,
          },
        },
        authLoading: false,
        isFirebaseConnected: false,
        isOnline: true,
      })
    ).toEqual({
      mode: 'local_only',
      reason: 'runtime_unavailable',
    });
  });
});
