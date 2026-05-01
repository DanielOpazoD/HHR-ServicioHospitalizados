import { describe, expect, it, vi } from 'vitest';
import type { AuthSessionState } from '@/types/authSessionTypes';
import { applyResolvedBootstrapSessionState } from '@/hooks/controllers/authResolvedBootstrapSessionController';

describe('authResolvedBootstrapSessionController', () => {
  const authorizedSession: AuthSessionState = {
    status: 'authorized',
    user: {
      uid: 'user-1',
      email: 'doctor@hospital.cl',
      displayName: 'Doctor',
      role: 'admin',
    },
  };

  it('logs first authenticated session resolution and clears bootstrap state', () => {
    const setSessionState = vi.fn();
    const setAuthLoading = vi.fn();
    const logUserLogin = vi.fn();
    const markPerf = vi.fn();
    const clearAuthBootstrapPending = vi.fn();
    const clearRecentManualLogout = vi.fn();
    const restoreAuthBootstrapReturnTo = vi.fn();
    const sessionStorageLike = new Map<string, string>();

    applyResolvedBootstrapSessionState({
      sessionState: authorizedSession,
      setSessionState,
      setAuthLoading,
      dependencies: {
        markPerf,
        isAuthBootstrapPending: () => true,
        restoreAuthBootstrapReturnTo,
        clearRecentManualLogout,
        clearAuthBootstrapPending,
        logUserLogin,
        getSessionStorageItem: key => sessionStorageLike.get(key) ?? null,
        setSessionStorageItem: (key, value) => sessionStorageLike.set(key, value),
      },
    });

    expect(markPerf).toHaveBeenCalledWith('auth-bootstrap:apply-session', 'authorized');
    expect(restoreAuthBootstrapReturnTo).toHaveBeenCalled();
    expect(clearRecentManualLogout).toHaveBeenCalled();
    expect(logUserLogin).toHaveBeenCalledWith('doctor@hospital.cl');
    expect(sessionStorageLike.get('hhr_logged_this_session')).toBe('true');
    expect(setSessionState).toHaveBeenCalledWith(authorizedSession);
    expect(setAuthLoading).toHaveBeenCalledWith(false);
    expect(clearAuthBootstrapPending).toHaveBeenCalled();
  });

  it('does not write login audit again when this browser session already logged it', () => {
    const logUserLogin = vi.fn();

    applyResolvedBootstrapSessionState({
      sessionState: authorizedSession,
      setSessionState: vi.fn(),
      setAuthLoading: vi.fn(),
      dependencies: {
        markPerf: vi.fn(),
        isAuthBootstrapPending: () => false,
        restoreAuthBootstrapReturnTo: vi.fn(),
        clearRecentManualLogout: vi.fn(),
        clearAuthBootstrapPending: vi.fn(),
        logUserLogin,
        getSessionStorageItem: () => 'true',
        setSessionStorageItem: vi.fn(),
      },
    });

    expect(logUserLogin).not.toHaveBeenCalled();
  });
});
