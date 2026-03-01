import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AUTH_UI_COPY } from '@/services/auth/authUiCopy';

const mockSignInWithGoogle = vi.fn();
const mockSignInWithGoogleRedirect = vi.fn();
const mockIsPopupRecoverableAuthError = vi.fn();
const mockGetLoginRuntimePolicy = vi.fn();

vi.mock('@/services/auth/authService', () => ({
  signInWithGoogle: (...args: unknown[]) => mockSignInWithGoogle(...args),
  signInWithGoogleRedirect: (...args: unknown[]) => mockSignInWithGoogleRedirect(...args),
}));

vi.mock('@/services/auth/authErrorPolicy', () => ({
  isPopupRecoverableAuthError: (...args: unknown[]) => mockIsPopupRecoverableAuthError(...args),
}));

vi.mock('@/features/auth/components/loginRuntimePolicy', () => ({
  getLoginRuntimePolicy: () => mockGetLoginRuntimePolicy(),
  getRedirectErrorMessage: (error: unknown) =>
    error instanceof Error ? error.message : AUTH_UI_COPY.redirectGenericError,
}));

import { useLoginPageController } from '@/features/auth/components/useLoginPageController';

describe('useLoginPageController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetLoginRuntimePolicy.mockReturnValue({
      preferRedirectOnLocalhost: false,
      isLocalhostRuntime: false,
      forcePopupForE2E: false,
      shouldAutoFallbackToRedirect: false,
      canUseRedirectAuth: true,
      redirectSupportLevel: 'ready',
      redirectDisabledReason: null,
      alternateAccessHint: 'Usa esta opción si el navegador bloqueó la ventana.',
    });
    mockIsPopupRecoverableAuthError.mockReturnValue(false);
    mockSignInWithGoogle.mockResolvedValue(undefined);
    mockSignInWithGoogleRedirect.mockResolvedValue(undefined);
  });

  it('calls onLoginSuccess when Google login succeeds', async () => {
    const onLoginSuccess = vi.fn();
    const { result } = renderHook(() => useLoginPageController(onLoginSuccess));

    await act(async () => {
      await result.current.handleGoogleSignIn();
    });

    expect(mockSignInWithGoogle).toHaveBeenCalled();
    expect(onLoginSuccess).toHaveBeenCalled();
    expect(result.current.error).toBeNull();
  });

  it('shows alternate access when popup issue is recoverable', async () => {
    const onLoginSuccess = vi.fn();
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('popup blocked'));
    mockIsPopupRecoverableAuthError.mockReturnValueOnce(true);

    const { result } = renderHook(() => useLoginPageController(onLoginSuccess));

    await act(async () => {
      await result.current.handleGoogleSignIn();
    });

    expect(result.current.showAlternateAccess).toBe(true);
    expect(result.current.error).toBe(AUTH_UI_COPY.blockedPopupManual);
    expect(result.current.alternateAccessHint).toContain('navegador bloqueó la ventana');
    expect(onLoginSuccess).not.toHaveBeenCalled();
  });

  it('automatically switches to redirect flow when policy allows fallback', async () => {
    mockGetLoginRuntimePolicy.mockReturnValue({
      preferRedirectOnLocalhost: false,
      isLocalhostRuntime: false,
      forcePopupForE2E: false,
      shouldAutoFallbackToRedirect: true,
      canUseRedirectAuth: true,
      redirectSupportLevel: 'ready',
      redirectDisabledReason: null,
      alternateAccessHint: AUTH_UI_COPY.alternateAccessHint,
    });
    mockSignInWithGoogle.mockRejectedValueOnce(new Error('popup blocked'));
    mockIsPopupRecoverableAuthError.mockReturnValueOnce(true);

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      await result.current.handleGoogleSignIn();
    });

    expect(mockSignInWithGoogleRedirect).toHaveBeenCalled();
    expect(result.current.error).toBe(AUTH_UI_COPY.blockedPopupRetrying);
  });

  it('surfaces redirect disabled reason when alternate access is blocked by runtime policy', async () => {
    mockGetLoginRuntimePolicy.mockReturnValue({
      preferRedirectOnLocalhost: false,
      isLocalhostRuntime: true,
      forcePopupForE2E: false,
      shouldAutoFallbackToRedirect: false,
      canUseRedirectAuth: false,
      redirectSupportLevel: 'disabled',
      redirectDisabledReason: 'En este equipo el ingreso directo está desactivado.',
      alternateAccessHint: 'La ventana normal de Google es la opción recomendada aquí.',
    });

    const { result } = renderHook(() => useLoginPageController(vi.fn()));

    await act(async () => {
      await result.current.handleAlternateAccess();
    });

    await waitFor(() => {
      expect(result.current.error).toContain('ingreso directo está desactivado');
    });
  });
});
