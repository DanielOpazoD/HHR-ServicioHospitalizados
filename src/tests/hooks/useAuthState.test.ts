import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

vi.unmock('@/hooks/useAuthState');

import { useAuthState } from '@/hooks/useAuthState';
import * as authService from '@/services/auth/authService';
import * as passportService from '@/services/auth/passportService';
import * as auditService from '@/services/admin/auditService';
import * as settingsService from '@/services/settingsService';
import { AuthUser, UserRole } from '@/types';

vi.mock('@/services/auth/authService', () => ({
  onAuthChange: vi.fn(),
  signOut: vi.fn(),
  hasActiveFirebaseSession: vi.fn(),
  signInAnonymouslyForPassport: vi.fn(),
  handleSignInRedirectResult: vi.fn(),
}));

vi.mock('@/services/auth/passportService', () => ({
  getStoredPassport: vi.fn(),
  validatePassport: vi.fn(),
  clearStoredPassport: vi.fn(),
  isEligibleForPassport: vi.fn(),
  downloadPassport: vi.fn(),
}));

vi.mock('@/services/admin/auditService', () => ({
  logUserLogin: vi.fn(),
  logUserLogout: vi.fn(),
}));

vi.mock('@/services/settingsService', () => ({
  getAppSetting: vi.fn(),
  saveAppSetting: vi.fn(),
}));

const setOnlineStatus = (online: boolean) => {
  Object.defineProperty(window.navigator, 'onLine', {
    configurable: true,
    get: () => online,
  });
};

describe('useAuthState baseline', () => {
  let authChangeCallback: ((user: AuthUser | null) => void | Promise<void>) | null = null;

  beforeEach(() => {
    vi.resetAllMocks();
    authChangeCallback = null;

    vi.mocked(authService.onAuthChange).mockImplementation(
      (cb: (user: AuthUser | null) => void | Promise<void>) => {
        authChangeCallback = cb;
        void cb(null);
        return () => {};
      }
    );

    vi.mocked(authService.handleSignInRedirectResult).mockResolvedValue(null);
    vi.mocked(authService.hasActiveFirebaseSession).mockReturnValue(false);
    vi.mocked(authService.signInAnonymouslyForPassport).mockResolvedValue('anon-id');

    vi.mocked(passportService.getStoredPassport).mockResolvedValue(null);
    vi.mocked(passportService.validatePassport).mockResolvedValue({ valid: false });
    vi.mocked(passportService.isEligibleForPassport).mockReturnValue(false);

    vi.mocked(settingsService.getAppSetting).mockResolvedValue(null);

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

  it('should recover offline passport', async () => {
    vi.mocked(settingsService.getAppSetting).mockResolvedValue({
      uid: 'off1',
      role: 'nurse_hospital',
    } as AuthUser);
    vi.mocked(passportService.getStoredPassport).mockResolvedValue({
      email: 'off1@hhr.cl',
      role: 'nurse_hospital' as UserRole,
      displayName: 'Offline Nurse',
      issuedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 3600000).toISOString(),
      signature: 'v2-mock-sig',
    });
    vi.mocked(passportService.validatePassport).mockResolvedValue({ valid: true });

    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.authLoading).toBe(false));
    expect(result.current.user?.uid).toBe('off1');
    expect(result.current.isOfflineMode).toBe(true);
  });

  it('should handle download passport branches', async () => {
    vi.mocked(passportService.downloadPassport).mockResolvedValue(true);
    const { result } = renderHook(() => useAuthState());

    await waitFor(() => expect(result.current.authLoading).toBe(false));

    await act(async () => {
      await authChangeCallback?.({
        uid: 'u1',
        email: 'u1@t.com',
        role: 'nurse_hospital' as UserRole,
        displayName: 'Nurse',
      });
    });

    const success = await result.current.handleDownloadPassport('nurse_hospital');
    expect(success).toBe(true);
    expect(passportService.downloadPassport).toHaveBeenCalled();
  });
});
