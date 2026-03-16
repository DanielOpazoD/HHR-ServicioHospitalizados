import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AuthSessionState } from '@/types/auth';
import { useResolvedAuthBootstrap } from '@/hooks/useAuthStateSupport';

const mockWarn = vi.fn();
const mockIsAuthBootstrapPending = vi.fn();
const mockClearAuthBootstrapPending = vi.fn();
const mockRestoreAuthBootstrapReturnTo = vi.fn();
const mockClearRecentManualLogout = vi.fn();
const mockHasRecentManualLogout = vi.fn();
const mockLogUserLogin = vi.fn();

vi.mock('@/services/utils/loggerService', () => ({
  logger: {
    child: () => ({
      warn: (...args: unknown[]) => mockWarn(...args),
    }),
  },
}));

vi.mock('@/services/auth/authBootstrapState', () => ({
  clearAuthBootstrapPending: () => mockClearAuthBootstrapPending(),
  isAuthBootstrapPending: () => mockIsAuthBootstrapPending(),
  restoreAuthBootstrapReturnTo: () => mockRestoreAuthBootstrapReturnTo(),
}));

vi.mock('@/services/auth/authLogoutState', () => ({
  clearRecentManualLogout: () => mockClearRecentManualLogout(),
  hasRecentManualLogout: () => mockHasRecentManualLogout(),
  markRecentManualLogout: vi.fn(),
}));

vi.mock('@/application/ports/auditPort', () => ({
  defaultAuditPort: {
    logUserLogin: (...args: unknown[]) => mockLogUserLogin(...args),
    logUserLogout: vi.fn(),
  },
}));

describe('useResolvedAuthBootstrap', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsAuthBootstrapPending.mockReturnValue(false);
    mockHasRecentManualLogout.mockReturnValue(false);
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    sessionStorage.clear();
  });

  it('cancels the safety timeout once auth state resolves', async () => {
    const onAuthSessionStateChange = vi.fn(
      (callback: (sessionState: AuthSessionState) => void | Promise<void>) => {
        setTimeout(() => {
          void callback({
            status: 'authorized',
            user: {
              uid: 'specialist-1',
              email: 'specialist@hospital.cl',
              displayName: 'Especialista',
              role: 'doctor_specialist',
            },
          });
        }, 100);
        return () => {};
      }
    );

    const resolveRedirectAuthSessionOutcome = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });

    const { result } = renderHook(() => {
      const [sessionState, setSessionState] = useState<AuthSessionState>({
        status: 'unauthenticated',
        user: null,
      });
      const [authLoading, setAuthLoading] = useState(true);

      useResolvedAuthBootstrap({
        e2eBootstrapUser: null,
        resolveRedirectAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.sessionState.status).toBe('authorized');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000);
    });

    expect(mockWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('Auth initialization timed out'),
      expect.anything()
    );
  });
});
