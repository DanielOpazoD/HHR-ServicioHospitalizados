import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

const mockSignInWithGoogle = vi.fn();
const mockIsPopupRecoverableAuthError = vi.fn();
const mockResolveAuthErrorCode = vi.fn();

vi.mock('@/services/auth/authService', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
}));

vi.mock('@/services/auth/authErrorPolicy', () => ({
  isPopupRecoverableAuthError: (...args: unknown[]) => mockIsPopupRecoverableAuthError(...args),
  resolveAuthErrorCode: (...args: unknown[]) => mockResolveAuthErrorCode(...args),
}));

import { useLoginPageController } from '@/features/auth/components/useLoginPageController';

describe('useLoginPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsPopupRecoverableAuthError.mockReturnValue(false);
    mockResolveAuthErrorCode.mockReturnValue(null);
    mockSignInWithGoogle.mockResolvedValue(undefined);
  });

  it('calls onLoginSuccess when Google login succeeds', async () => {
    const onLoginSuccess = vi.fn();
    const { result } = renderHook(() => useLoginPageController(onLoginSuccess));

    await act(async () => {
      await result.current.handleGoogleSignIn();
    });

    expect(mockSignInWithGoogle).toHaveBeenCalledTimes(1);
    expect(onLoginSuccess).toHaveBeenCalledTimes(1);
    expect(result.current.error).toBeNull();
    expect(result.current.isAnyLoading).toBe(false);
  });

  it('keeps the user on the same login screen when the popup has a recoverable issue', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('popup blocked'));
    mockIsPopupRecoverableAuthError.mockReturnValueOnce(true);

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      await result.current.handleGoogleSignIn();
    });

    expect(result.current.errorCode).toBe('auth/popup-recoverable');
    expect(result.current.error).toBe(AUTH_UI_COPY.blockedPopupStayOnPage);
    expect(result.current.isGoogleLoading).toBe(false);
    expect(result.current.isAnyLoading).toBe(false);
  });

  it('surfaces non-recoverable popup errors without switching flows', async () => {
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('google auth down'));
    mockResolveAuthErrorCode.mockReturnValueOnce('auth/google-signin-failed');

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      await result.current.handleGoogleSignIn();
    });

    expect(result.current.errorCode).toBe('auth/google-signin-failed');
    expect(result.current.error).toBe('google auth down');
    expect(result.current.isGoogleLoading).toBe(false);
  });
});
