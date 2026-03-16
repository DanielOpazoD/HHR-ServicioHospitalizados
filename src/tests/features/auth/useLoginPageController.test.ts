import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';
import {
  createApplicationFailed,
  createApplicationSuccess,
} from '@/application/shared/applicationOutcome';
import type { AuthSessionState } from '@/types';

const mockExecuteGoogleSignIn = vi.fn();
const mockIsPopupRecoverableAuthError = vi.fn();
const mockResolveAuthErrorCode = vi.fn();
const mockIsAuthBootstrapPending = vi.fn();
const mockGetCurrentAuthSessionState = vi.fn();

vi.mock('@/application/auth', () => ({
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
      await vi.advanceTimersByTimeAsync(1200);
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
      await vi.advanceTimersByTimeAsync(1200);
      await promise;
    });

    expect(result.current.errorCode).toBeNull();
    expect(result.current.error).toBeNull();
  });
});
