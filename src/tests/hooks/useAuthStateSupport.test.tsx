import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState } from 'react';
import type { AuthSessionState } from '@/types/auth';
import { useResolvedAuthBootstrap } from '@/hooks/useAuthStateSupport';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcome';

const mockWarn = vi.fn();
const mockInfo = vi.fn();
const mockIsAuthBootstrapPending = vi.fn();
const mockGetAuthBootstrapPendingAgeMs = vi.fn();
const mockClearAuthBootstrapPending = vi.fn();
const mockRestoreAuthBootstrapReturnTo = vi.fn();
const mockClearRecentManualLogout = vi.fn();
const mockHasRecentManualLogout = vi.fn();
const mockHasActiveFirebaseSession = vi.fn();
const mockLogUserLogin = vi.fn();
const mockRecordOperationalOutcome = vi.fn();
const mockRecordOperationalTelemetry = vi.fn();

vi.mock('@/services/utils/loggerService', () => ({
  logger: {
    child: () => ({
      warn: (...args: unknown[]) => mockWarn(...args),
      info: (...args: unknown[]) => mockInfo(...args),
    }),
  },
}));

vi.mock('@/services/auth/authBootstrapState', () => ({
  clearAuthBootstrapPending: () => mockClearAuthBootstrapPending(),
  getAuthBootstrapPendingAgeMs: () => mockGetAuthBootstrapPendingAgeMs(),
  isAuthBootstrapPending: () => mockIsAuthBootstrapPending(),
  restoreAuthBootstrapReturnTo: () => mockRestoreAuthBootstrapReturnTo(),
}));

vi.mock('@/services/auth/authLogoutState', () => ({
  clearRecentManualLogout: () => mockClearRecentManualLogout(),
  hasRecentManualLogout: () => mockHasRecentManualLogout(),
  markRecentManualLogout: vi.fn(),
}));

vi.mock('@/services/auth/authFallback', () => ({
  hasActiveFirebaseSession: () => mockHasActiveFirebaseSession(),
}));

vi.mock('@/application/ports/auditPort', () => ({
  defaultAuditPort: {
    logUserLogin: (...args: unknown[]) => mockLogUserLogin(...args),
    logUserLogout: vi.fn(),
  },
}));

vi.mock('@/services/observability/operationalTelemetryService', () => ({
  recordOperationalOutcome: (...args: unknown[]) => mockRecordOperationalOutcome(...args),
  recordOperationalTelemetry: (...args: unknown[]) => mockRecordOperationalTelemetry(...args),
}));

describe('useResolvedAuthBootstrap', () => {
  const flushBootstrapSetup = async () => {
    await Promise.resolve();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await Promise.resolve();
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockIsAuthBootstrapPending.mockReturnValue(false);
    mockGetAuthBootstrapPendingAgeMs.mockReturnValue(0);
    mockHasRecentManualLogout.mockReturnValue(false);
    mockHasActiveFirebaseSession.mockReturnValue(false);
    Object.defineProperty(window.navigator, 'onLine', {
      configurable: true,
      get: () => true,
    });
    localStorage.clear();
    sessionStorage.clear();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('cancels the safety timeout once auth state resolves', async () => {
    window.localStorage.setItem('firebase:authUser:test:[DEFAULT]', '{"uid":"persisted"}');

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
    const resolveCurrentAuthSessionOutcome = vi
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
        resolveCurrentAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await flushBootstrapSetup();
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.sessionState.status).toBe('authorized');

    await act(async () => {
      await flushBootstrapSetup();
      await vi.advanceTimersByTimeAsync(16000);
    });

    expect(mockWarn).not.toHaveBeenCalledWith(
      expect.stringContaining('Auth initialization timed out'),
      expect.anything()
    );
    expect(mockRecordOperationalOutcome).toHaveBeenCalledWith(
      'auth',
      'redirect_resolution',
      expect.objectContaining({ status: 'success' }),
      expect.objectContaining({ allowSuccess: true })
    );
  });

  it('forces auth loading completion on bootstrap timeout', async () => {
    window.localStorage.setItem('firebase:authUser:test:[DEFAULT]', '{"uid":"persisted"}');
    mockHasActiveFirebaseSession.mockReturnValue(true);

    const onAuthSessionStateChange = vi.fn(() => () => {});
    const resolveRedirectAuthSessionOutcome = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });
    const resolveCurrentAuthSessionOutcome = vi
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
        resolveCurrentAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(16000);
    });

    expect(result.current.authLoading).toBe(false);
    expect(mockInfo).toHaveBeenCalledWith(
      expect.stringContaining('Auth initialization timed out'),
      expect.anything()
    );
    expect(mockRecordOperationalTelemetry).toHaveBeenCalledWith(
      expect.objectContaining({
        category: 'auth',
        operation: 'bootstrap_timeout',
        status: 'degraded',
        runtimeState: 'recoverable',
        context: expect.objectContaining({
          budgetProfile: 'default',
          pendingAgeMs: 0,
        }),
      })
    );
  });

  it('revalidates the current session on timeout before falling back to unauthenticated', async () => {
    window.localStorage.setItem('firebase:authUser:test:[DEFAULT]', '{"uid":"persisted"}');
    mockHasActiveFirebaseSession.mockReturnValue(true);

    const onAuthSessionStateChange = vi.fn(() => () => {});
    const resolveRedirectAuthSessionOutcome = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });
    const resolveCurrentAuthSessionOutcome = vi
      .fn()
      .mockResolvedValueOnce({ status: 'success', data: null, issues: [] })
      .mockResolvedValueOnce({
        status: 'success',
        data: {
          status: 'authorized',
          user: {
            uid: 'persisted-1',
            email: 'persisted@hospital.cl',
            displayName: 'Persisted Session',
            role: 'admin',
          },
        },
        issues: [],
      });

    const { result } = renderHook(() => {
      const [sessionState, setSessionState] = useState<AuthSessionState>({
        status: 'authenticating',
        user: null,
      });
      const [authLoading, setAuthLoading] = useState(true);

      useResolvedAuthBootstrap({
        e2eBootstrapUser: null,
        resolveRedirectAuthSessionOutcome,
        resolveCurrentAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await flushBootstrapSetup();
      await vi.advanceTimersByTimeAsync(16000);
      await Promise.resolve();
    });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.sessionState).toEqual(
      expect.objectContaining({
        status: 'authorized',
        user: expect.objectContaining({ uid: 'persisted-1' }),
      })
    );
    expect(resolveCurrentAuthSessionOutcome).toHaveBeenCalledTimes(2);
    expect(mockRecordOperationalOutcome).toHaveBeenCalledWith(
      'auth',
      'timeout_current_session_resolution',
      expect.objectContaining({ status: 'success' }),
      expect.objectContaining({ allowSuccess: true })
    );
  });

  it('hydrates the current firebase session before the auth observer resolves', async () => {
    const onAuthSessionStateChange = vi.fn(() => () => {});
    const resolveRedirectAuthSessionOutcome = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });
    const resolveCurrentAuthSessionOutcome = vi.fn().mockResolvedValue({
      status: 'success',
      data: {
        status: 'authorized',
        user: {
          uid: 'existing-1',
          email: 'existing@hospital.cl',
          displayName: 'Existing Session',
          role: 'admin',
        },
      },
      issues: [],
    });

    const { result } = renderHook(() => {
      const [sessionState, setSessionState] = useState<AuthSessionState>({
        status: 'unauthenticated',
        user: null,
      });
      const [authLoading, setAuthLoading] = useState(true);

      useResolvedAuthBootstrap({
        e2eBootstrapUser: null,
        resolveRedirectAuthSessionOutcome,
        resolveCurrentAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.sessionState).toEqual(
      expect.objectContaining({
        status: 'authorized',
        user: expect.objectContaining({
          uid: 'existing-1',
        }),
      })
    );
    expect(mockRecordOperationalOutcome).toHaveBeenCalledWith(
      'auth',
      'current_session_resolution',
      expect.objectContaining({ status: 'success' }),
      expect.objectContaining({ allowSuccess: true })
    );
  });

  it('resolves immediately to unauthenticated when no persisted session hints exist', async () => {
    const onAuthSessionStateChange = vi.fn(() => () => {});
    const resolveRedirectAuthSessionOutcome = vi
      .fn<() => Promise<ApplicationOutcome<AuthSessionState | null>>>()
      .mockResolvedValue({
        status: 'success',
        data: null,
        issues: [],
      });
    const resolveCurrentAuthSessionOutcome = vi
      .fn<() => Promise<ApplicationOutcome<AuthSessionState | null>>>()
      .mockResolvedValue({
        status: 'success',
        data: null,
        issues: [],
      });

    const { result } = renderHook(() => {
      const [sessionState, setSessionState] = useState<AuthSessionState>({
        status: 'authenticating',
        user: null,
      });
      const [authLoading, setAuthLoading] = useState(true);

      useResolvedAuthBootstrap({
        e2eBootstrapUser: null,
        resolveRedirectAuthSessionOutcome,
        resolveCurrentAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await Promise.resolve();
    });

    await vi.waitFor(() => {
      expect(result.current.authLoading).toBe(false);
      expect(result.current.sessionState).toEqual({
        status: 'unauthenticated',
        user: null,
      });
    });
    expect(mockClearAuthBootstrapPending).toHaveBeenCalled();
  });

  it('applies a failed current-session resolution immediately when it already includes an auth terminal state', async () => {
    const onAuthSessionStateChange = vi.fn(() => () => {});
    const resolveRedirectAuthSessionOutcome = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });
    const resolveCurrentAuthSessionOutcome = vi.fn().mockResolvedValue({
      status: 'failed',
      data: {
        status: 'auth_error',
        user: null,
        error: {
          code: 'auth_session_state_resolution_failed',
          message: 'No se pudo resolver la sesion actual.',
          userSafeMessage: 'No se pudo resolver la sesion actual.',
          retryable: true,
          severity: 'warning',
        },
      },
      issues: [
        {
          kind: 'unknown',
          code: 'auth_session_state_resolution_failed',
          message: 'No se pudo resolver la sesion actual.',
        },
      ],
      reason: 'auth_session_state_resolution_failed',
      retryable: true,
      severity: 'warning',
    });

    const { result } = renderHook(() => {
      const [sessionState, setSessionState] = useState<AuthSessionState>({
        status: 'authenticating',
        user: null,
      });
      const [authLoading, setAuthLoading] = useState(true);

      useResolvedAuthBootstrap({
        e2eBootstrapUser: null,
        resolveRedirectAuthSessionOutcome,
        resolveCurrentAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.sessionState).toEqual(
      expect.objectContaining({
        status: 'auth_error',
        error: expect.objectContaining({
          code: 'auth_session_state_resolution_failed',
        }),
      })
    );
  });

  it('ignores a transient unauthenticated auth event while a persisted Firebase session still exists', async () => {
    window.localStorage.setItem('firebase:authUser:test:[DEFAULT]', '{"uid":"abc"}');

    const onAuthSessionStateChange = vi.fn(
      (callback: (sessionState: AuthSessionState) => void | Promise<void>) => {
        setTimeout(() => {
          void callback({
            status: 'unauthenticated',
            user: null,
          });
        }, 10);
        setTimeout(() => {
          void callback({
            status: 'authorized',
            user: {
              uid: 'persisted-1',
              email: 'persisted@hospital.cl',
              displayName: 'Persisted Session',
              role: 'admin',
            },
          });
        }, 100);
        return () => {};
      }
    );
    const resolveRedirectAuthSessionOutcome = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });
    const resolveCurrentAuthSessionOutcome = vi
      .fn()
      .mockResolvedValue({ status: 'success', data: null, issues: [] });

    const { result } = renderHook(() => {
      const [sessionState, setSessionState] = useState<AuthSessionState>({
        status: 'authenticating',
        user: null,
      });
      const [authLoading, setAuthLoading] = useState(true);

      useResolvedAuthBootstrap({
        e2eBootstrapUser: null,
        resolveRedirectAuthSessionOutcome,
        resolveCurrentAuthSessionOutcome,
        onAuthSessionStateChange,
        setSessionState,
        setAuthLoading,
      });

      return { sessionState, authLoading };
    });

    await act(async () => {
      await flushBootstrapSetup();
      await vi.advanceTimersByTimeAsync(150);
    });

    expect(result.current.authLoading).toBe(false);
    expect(result.current.sessionState).toEqual(
      expect.objectContaining({
        status: 'authorized',
        user: expect.objectContaining({ uid: 'persisted-1' }),
      })
    );
  });
});
