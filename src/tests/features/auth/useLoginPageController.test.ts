import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';
import {
  createApplicationFailed,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { AuthSessionState } from '@/types/authSessionTypes';

const mockExecuteGoogleSignIn = vi.fn();
const mockIsPopupRecoverableAuthError = vi.fn();
const mockResolveAuthErrorCode = vi.fn();
const mockIsAuthBootstrapPending = vi.fn();
const mockGetCurrentAuthSessionState = vi.fn();

vi.mock('@/application/auth/authSessionUseCases', () => ({
  executeGoogleSignIn: (...args: unknown[]) => mockExecuteGoogleSignIn(...args),
}));

vi.mock('@/services/auth/authErrorPolicy', () => ({
  isPopupRecoverableAuthError: (...args: unknown[]) => mockIsPopupRecoverableAuthError(...args),
  resolveAuthErrorCode: (...args: unknown[]) => mockResolveAuthErrorCode(...args),
}));

vi.mock('@/services/auth/authBootstrapState', () => ({
  isAuthBootstrapPending: (...args: unknown[]) => mockIsAuthBootstrapPending(...args),
}));

vi.mock('@/services/auth/authSession', () => ({
  getCurrentAuthSessionState: (...args: unknown[]) => mockGetCurrentAuthSessionState(...args),
}));

import { useLoginPageController } from '@/features/auth/components/useLoginPageController';

describe('useLoginPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    window.localStorage.clear();
    mockIsPopupRecoverableAuthError.mockReturnValue(false);
    mockResolveAuthErrorCode.mockReturnValue(null);
    mockIsAuthBootstrapPending.mockReturnValue(false);
    mockGetCurrentAuthSessionState.mockReturnValue({
      status: 'unauthenticated',
      user: null,
    });
    mockExecuteGoogleSignIn.mockResolvedValue(
      createApplicationSuccess<AuthSessionState>({
        status: 'authorized',
        user: {
          uid: 'google-1',
          email: 'test@hospital.cl',
          displayName: 'Google User',
          role: 'admin',
        },
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    window.localStorage.clear();
  });

  it('initializes from the persisted login background mode', () => {
    vi.setSystemTime(new Date('2026-04-24T23:00:00'));
    window.localStorage.setItem('hhr_login_background_mode', 'night');

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    expect(result.current.backgroundMode).toBe('night');
    expect(result.current.isDayGradient).toBe(false);
  });

  it('ignores a persisted day background after the runtime enters the night period', () => {
    vi.setSystemTime(new Date('2026-04-24T23:00:00'));
    window.localStorage.setItem('hhr_login_background_mode', 'day');

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    expect(result.current.backgroundMode).toBe('night');
    expect(result.current.isDayGradient).toBe(false);
  });

  it('persists manual login background mode changes across refreshes', () => {
    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    act(() => {
      result.current.toggleBackgroundMode();
    });

    expect(window.localStorage.getItem('hhr_login_background_mode')).toContain(
      result.current.backgroundMode
    );
  });

  it('calls onLoginSuccess when Google login succeeds', async () => {
    const onLoginSuccess = vi.fn();
    const { result } = renderHook(() => useLoginPageController(onLoginSuccess));

    await act(async () => {
      const promise = result.current.handleGoogleSignIn();
      await vi.runAllTimersAsync();
      await promise;
    });

    expect(mockExecuteGoogleSignIn).toHaveBeenCalledTimes(1);
    expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isAnyLoading).toBe(false);
  });

  it('keeps the user on the same login screen when the popup has a recoverable issue', async () => {
    mockExecuteGoogleSignIn.mockResolvedValueOnce(
      createApplicationFailed<AuthSessionState>(
        {
          status: 'auth_error',
          user: null,
          error: {
            code: 'auth/popup-blocked',
            message: 'popup blocked',
          },
        },
        [{ kind: 'unknown', code: 'auth/popup-blocked', message: 'popup blocked' }]
      )
    );
    mockIsPopupRecoverableAuthError.mockReturnValueOnce(true);
    mockResolveAuthErrorCode.mockReturnValueOnce('auth/popup-blocked');

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      const promise = result.current.handleGoogleSignIn();
      await vi.advanceTimersByTimeAsync(1800);
      await promise;
    });

    expect(result.current.errorCode).toBe('auth/popup-blocked');
    expect(result.current.error).toBe(AUTH_UI_COPY.blockedPopupStayOnPage);
    expect(result.current.isGoogleLoading).toBe(false);
    expect(result.current.isAnyLoading).toBe(false);
  });

  it('surfaces non-recoverable popup errors without switching flows', async () => {
    mockExecuteGoogleSignIn.mockResolvedValueOnce(
      createApplicationFailed<AuthSessionState>(
        {
          status: 'auth_error',
          user: null,
          error: {
            code: 'auth/google-signin-failed',
            message: 'google auth down',
          },
        },
        [{ kind: 'unknown', code: 'auth/google-signin-failed', message: 'google auth down' }]
      )
    );
    mockResolveAuthErrorCode.mockReturnValueOnce('auth/google-signin-failed');

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      const promise = result.current.handleGoogleSignIn();
      await vi.runAllTimersAsync();
      await promise;
    });

    expect(result.current.errorCode).toBe('auth/google-signin-failed');
    expect(result.current.error).toBe('google auth down');
    expect(result.current.isGoogleLoading).toBe(false);
    expect(result.current.canRetryGoogleSignIn).toBe(false);
  });

  it('enables explicit retry when Google auth resolves with temporary access validation failure', async () => {
    mockExecuteGoogleSignIn.mockResolvedValueOnce(
      createApplicationFailed<AuthSessionState>(
        {
          status: 'auth_error',
          user: null,
          error: {
            code: 'auth/role-validation-unavailable',
            message:
              'No se pudo validar tu acceso en este momento. Intenta nuevamente en unos segundos.',
          },
        },
        [
          {
            kind: 'unknown',
            code: 'auth/role-validation-unavailable',
            message:
              'No se pudo validar tu acceso en este momento. Intenta nuevamente en unos segundos.',
          },
        ]
      )
    );
    mockResolveAuthErrorCode.mockReturnValueOnce('auth/role-validation-unavailable');

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      const promise = result.current.handleGoogleSignIn();
      await vi.runAllTimersAsync();
      await promise;
    });

    expect(result.current.errorCode).toBe('auth/role-validation-unavailable');
    expect(result.current.canRetryGoogleSignIn).toBe(true);
  });

  it('suppresses recoverable popup warnings when auth session resolves during the grace window', async () => {
    mockExecuteGoogleSignIn.mockResolvedValueOnce(
      createApplicationFailed<AuthSessionState>(
        {
          status: 'auth_error',
          user: null,
          error: {
            code: 'auth/popup-blocked',
            message: 'popup blocked',
          },
        },
        [{ kind: 'unknown', code: 'auth/popup-blocked', message: 'popup blocked' }]
      )
    );
    mockIsPopupRecoverableAuthError.mockReturnValueOnce(true);
    mockResolveAuthErrorCode.mockReturnValueOnce('auth/popup-blocked');
    mockGetCurrentAuthSessionState
      .mockReturnValueOnce({ status: 'unauthenticated', user: null })
      .mockReturnValueOnce({
        status: 'authorized',
        user: {
          uid: 'specialist-1',
          email: 'specialist@hospital.cl',
          displayName: 'Especialista',
          role: 'doctor_specialist',
        },
      });

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      const promise = result.current.handleGoogleSignIn();
      await vi.advanceTimersByTimeAsync(1800);
      await promise;
    });

    expect(result.current.errorCode).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
