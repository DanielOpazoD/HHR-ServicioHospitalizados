import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.unmock('@/hooks/useAuthState');

import { useAuthState } from '@/hooks/useAuthState';
import * as authService from '@/services/auth/authService';
import * as auditService from '@/services/admin/auditService';
import { AuthUser, UserRole } from '@/types';

vi.mock('@/services/auth/authService', () => ({
  onAuthChange: vi.fn(),
  signOut: vi.fn(),
  hasActiveFirebaseSession: vi.fn(),
  handleSignInRedirectResult: vi.fn(),
}));

vi.mock('@/services/admin/auditService', () => ({
  logUserLogin: vi.fn(),
  logUserLogout: vi.fn(),
}));

const setOnlineStatus = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
};

describe('useAuthState baseline', () => {
  const AUTH_BOOTSTRAP_PENDING_KEY = 'hhr_auth_bootstrap_pending_v1';
  let authChangeCallback: ((user: AuthUser | null) => void | Promise<void>) | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    authChangeCallback = null;
    localStorage.removeItem(AUTH_BOOTSTRAP_PENDING_KEY);

    vi.mocked(authService.onAuthChange).mockImplementation(
      (cb: (user: AuthUser | null) => void | Promise<void>) => {
        authChangeCallback = cb;
        void cb(null);
        return () => {};
      }
    );

    vi.mocked(authService.handleSignInRedirectResult).mockResolvedValue(null);
    vi.mocked(authService.hasActiveFirebaseSession).mockReturnValue(false);

    setOnlineStatus(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should initialize and handle login', async () => {
    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.authLoading).toBe(false));

    const user: AuthUser = {
      uid: 'u123',
      email: 'test@hhr.cl',
      role: 'editor' as UserRole,
      displayName: 'Test Editor',
    };

    await act(async () => {
      await authChangeCallback?.(user);
    });

    expect(result.current.user?.uid).toBe('u123');
    expect(result.current.isEditor).toBe(true);
  });

  it('should handle manual logout', async () => {
    const { result } = renderHook(() => useAuthState());
    await waitFor(() => expect(result.current.authLoading).toBe(false));

    await act(async () => {
      await authChangeCallback?.({
        uid: 'u1',
        email: 't@t.com',
        role: 'admin' as UserRole,
        displayName: 'Admin',
      });
    });

    await act(async () => {
      await result.current.handleLogout('manual');
    });

    expect(result.current.user).toBe(null);
    expect(authService.signOut).toHaveBeenCalled();
  });

  it('should handle inactivity timeout', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAuthState());

    await act(async () => {
      vi.advanceTimersByTime(16000);
    });

    expect(result.current.authLoading).toBe(false);

    const user: AuthUser = {
      uid: 'u1',
      email: 't@t.com',
      role: 'admin' as UserRole,
      displayName: 'Admin',
    };

    await act(async () => {
      await authChangeCallback?.(user);
    });

    await act(async () => {
      vi.advanceTimersByTime(61 * 60 * 1000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.user).toBe(null);
    expect(auditService.logUserLogout).toHaveBeenCalledWith('t@t.com', 'automatic');
  });

  it('should handle network status switches', async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() => useAuthState());

    vi.mocked(authService.hasActiveFirebaseSession).mockReturnValue(true);
    act(() => {
      vi.advanceTimersByTime(1100);
    });
    expect(result.current.isFirebaseConnected).toBe(true);

    setOnlineStatus(false);
    await act(async () => {
      window.dispatchEvent(new Event('offline'));
      vi.advanceTimersByTime(1100);
    });
    expect(result.current.isFirebaseConnected).toBe(false);

    setOnlineStatus(true);
    await act(async () => {
      window.dispatchEvent(new Event('online'));
      vi.advanceTimersByTime(1100);
    });
    expect(result.current.isFirebaseConnected).toBe(true);
  });

  it('extends auth bootstrap timeout while redirect login is pending', async () => {
    vi.useFakeTimers();
    localStorage.setItem(
      AUTH_BOOTSTRAP_PENDING_KEY,
      JSON.stringify({ startedAt: Date.now(), mode: 'redirect' })
    );

    // Simulate Firebase not notifying auth state yet.
    vi.mocked(authService.onAuthChange).mockImplementation(() => () => {});

    const { result } = renderHook(() => useAuthState());

    await act(async () => {
      vi.advanceTimersByTime(16000);
    });

    expect(result.current.authLoading).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(30000);
      await vi.runOnlyPendingTimersAsync();
    });

    expect(result.current.authLoading).toBe(false);
    expect(localStorage.getItem(AUTH_BOOTSTRAP_PENDING_KEY)).toBeNull();
  });

  it('hydrates user from redirect result before auth subscription resolves', async () => {
    const redirectUser: AuthUser = {
      uid: 'redirect-1',
      email: 'redirect@hhr.cl',
      role: 'viewer' as UserRole,
      displayName: 'Redirect User',
    };

    vi.mocked(authService.handleSignInRedirectResult).mockResolvedValueOnce(redirectUser);
    vi.mocked(authService.onAuthChange).mockImplementation(() => () => {});

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.authLoading).toBe(false));

    expect(result.current.user?.uid).toBe('redirect-1');
    expect(result.current.role).toBe('viewer');
  });

  it('should keep anonymous signature-mode users when Firebase returns one', async () => {
    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.authLoading).toBe(false));

    await act(async () => {
      await authChangeCallback?.({
        uid: 'anon-signature',
        email: null,
        role: 'viewer' as UserRole,
        displayName: 'Firma',
      });
    });

    expect(result.current.user?.uid).toBe('anon-signature');
    expect(result.current.role).toBe('viewer');
  });
});
