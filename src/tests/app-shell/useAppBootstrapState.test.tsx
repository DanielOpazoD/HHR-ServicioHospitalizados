import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextType } from '@/context';
import type { UseDateNavigationReturn } from '@/hooks/useDateNavigation';
import type { AuthUser } from '@/types/auth';

const {
  mockUseAuth,
  mockUseDateNavigation,
  mockUseSignatureMode,
  mockUseStorageMigration,
  mockUseVersionCheck,
  mockSetFirestoreSyncState,
  mockGetOptionalDb,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseDateNavigation: vi.fn(),
  mockUseSignatureMode: vi.fn(),
  mockUseStorageMigration: vi.fn(),
  mockUseVersionCheck: vi.fn(),
  mockSetFirestoreSyncState: vi.fn(),
  mockGetOptionalDb: vi.fn(() => null),
}));

vi.mock('@/context', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks', () => ({
  useDateNavigation: () => mockUseDateNavigation(),
  useSignatureMode: (...args: unknown[]) => mockUseSignatureMode(...args),
  useVersionCheck: () => mockUseVersionCheck(),
}));

vi.mock('@/hooks/useStorageMigration', () => ({
  useStorageMigration: (...args: unknown[]) => mockUseStorageMigration(...args),
}));

vi.mock('@/services/repositories/repositoryConfig', () => ({
  setFirestoreSyncState: (...args: unknown[]) => mockSetFirestoreSyncState(...args),
}));

vi.mock('@/services/firebase-runtime/firebaseConfigRuntimeAdapter', () => ({
  defaultFirebaseConfigRuntimeAdapter: {
    getOptionalDb: () => mockGetOptionalDb(),
  },
}));

import {
  buildAppBootstrapState,
  useAppBootstrapState,
} from '@/app-shell/bootstrap/useAppBootstrapState';

const createAuthState = (overrides: Partial<AuthContextType> = {}): AuthContextType => {
  const remoteSyncStatus = (overrides.remoteSyncStatus || 'local_only') as
    | 'ready'
    | 'bootstrapping'
    | 'local_only';
  const remoteSyncState =
    overrides.remoteSyncState ||
    (remoteSyncStatus === 'ready'
      ? {
          mode: 'enabled',
          reason: 'ready',
        }
      : remoteSyncStatus === 'bootstrapping'
        ? {
            mode: 'bootstrapping',
            reason: 'auth_loading',
          }
        : {
            mode: 'local_only',
            reason: 'auth_unavailable',
          });

  return {
    sessionState: { status: 'unauthenticated', user: null },
    authRuntime: {} as never,
    currentUser: null,
    authorizedUser: null,
    user: null,
    role: 'viewer',
    isLoading: false,
    isAuthenticated: false,
    isAuthorizedSession: false,
    isAnonymousSignature: false,
    isUnauthorized: false,
    isEditor: false,
    isViewer: true,
    isFirebaseConnected: false,
    remoteSyncStatus,
    remoteSyncState,
    signOut: vi.fn(),
    ...overrides,
  };
};

const createDateNavigation = (
  overrides: Partial<UseDateNavigationReturn> = {}
): UseDateNavigationReturn => ({
  selectedYear: 2026,
  setSelectedYear: vi.fn(),
  selectedMonth: 2,
  setSelectedMonth: vi.fn(),
  selectedDay: 27,
  setSelectedDay: vi.fn(),
  daysInMonth: 31,
  currentDateString: '2026-03-27',
  navigateDays: vi.fn(),
  ...overrides,
});

describe('useAppBootstrapState', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetOptionalDb.mockReturnValue(null);
    mockUseAuth.mockReturnValue(createAuthState());
    mockUseDateNavigation.mockReturnValue(createDateNavigation());
    mockUseSignatureMode.mockReturnValue({
      isSignatureMode: false,
      signatureDate: null,
      currentDateString: '2026-03-27',
    });
  });

  it('returns loading while auth is resolving and keeps migration disabled', async () => {
    mockUseAuth.mockReturnValue(
      createAuthState({
        isLoading: true,
        isFirebaseConnected: true,
        remoteSyncStatus: 'bootstrapping',
      })
    );

    const { result } = renderHook(() => useAppBootstrapState());

    expect(result.current.status).toBe('loading');
    expect(mockUseStorageMigration).toHaveBeenCalledWith({ enabled: false });
    expect(mockUseVersionCheck).toHaveBeenCalledTimes(1);
    expect(mockUseSignatureMode).toHaveBeenCalledWith('2026-03-27', null, true);
    await waitFor(() => {
      expect(mockSetFirestoreSyncState).toHaveBeenCalledWith({
        mode: 'bootstrapping',
        reason: 'auth_loading',
      });
    });
  });

  it('falls back to unauthenticated when the session has no active loading flag', async () => {
    mockUseAuth.mockReturnValue(
      createAuthState({
        sessionState: { status: 'authenticating', user: null },
        isLoading: false,
        isAuthenticated: false,
        isFirebaseConnected: false,
        remoteSyncStatus: 'bootstrapping',
      })
    );

    const { result } = renderHook(() => useAppBootstrapState());

    expect(result.current.status).toBe('unauthenticated');
    await waitFor(() =>
      expect(mockSetFirestoreSyncState).toHaveBeenCalledWith({
        mode: 'bootstrapping',
        reason: 'auth_loading',
      })
    );
  });

  it('prioritizes signature mode over loading and auth gating', () => {
    mockUseAuth.mockReturnValue(
      createAuthState({
        isLoading: true,
      })
    );
    mockUseSignatureMode.mockReturnValue({
      isSignatureMode: true,
      signatureDate: '27-03-2026',
      currentDateString: '2026-03-27',
    });

    const { result } = renderHook(() => useAppBootstrapState());

    expect(result.current.status).toBe('signature_mode');
    expect(mockUseStorageMigration).toHaveBeenCalledWith({ enabled: false });
  });

  it('returns unauthenticated when there is no active session', () => {
    const { result } = renderHook(() => useAppBootstrapState());

    expect(result.current.status).toBe('unauthenticated');
    expect(mockSetFirestoreSyncState).toHaveBeenCalledWith({
      mode: 'local_only',
      reason: 'auth_unavailable',
    });
  });

  it('returns authenticated with the resolved app date navigation', () => {
    const currentUser: AuthUser = {
      uid: 'user-1',
      email: 'admin@hospital.cl',
      displayName: 'Admin',
      role: 'admin',
    };
    mockUseAuth.mockReturnValue(
      createAuthState({
        currentUser,
        authorizedUser: currentUser,
        user: currentUser,
        role: 'admin',
        isAuthenticated: true,
        isAuthorizedSession: true,
        isEditor: true,
        isViewer: false,
        isFirebaseConnected: true,
        remoteSyncStatus: 'ready',
      })
    );
    mockUseSignatureMode.mockReturnValue({
      isSignatureMode: false,
      signatureDate: null,
      currentDateString: '2026-03-31',
    });
    mockGetOptionalDb.mockReturnValue({ name: 'db' } as never);

    const { result } = renderHook(() => useAppBootstrapState());

    expect(result.current.status).toBe('authenticated');
    if (result.current.status === 'authenticated') {
      expect(result.current.dateNav.currentDateString).toBe('2026-03-31');
      expect(result.current.dateNav.isSignatureMode).toBe(false);
    }
    expect(mockUseStorageMigration).toHaveBeenCalledWith({ enabled: true });
    expect(mockUseSignatureMode).toHaveBeenCalledWith('2026-03-27', currentUser, false);
    expect(mockSetFirestoreSyncState).toHaveBeenCalledWith({
      mode: 'enabled',
      reason: 'ready',
    });
  });

  it('keeps Firestore disabled while an authenticated session reconnects Firebase', () => {
    const currentUser: AuthUser = {
      uid: 'user-1',
      email: 'admin@hospital.cl',
      displayName: 'Admin',
      role: 'admin',
    };
    mockUseAuth.mockReturnValue(
      createAuthState({
        sessionState: { status: 'authorized', user: currentUser },
        currentUser,
        authorizedUser: currentUser,
        user: currentUser,
        role: 'admin',
        isAuthenticated: true,
        isAuthorizedSession: true,
        isEditor: true,
        isViewer: false,
        isFirebaseConnected: false,
        remoteSyncStatus: 'bootstrapping',
      })
    );

    renderHook(() => useAppBootstrapState());

    expect(mockSetFirestoreSyncState).toHaveBeenCalledWith({
      mode: 'bootstrapping',
      reason: 'auth_loading',
    });
  });

  it('keeps Firestore in bootstrapping until the runtime exposes db for an authenticated session', async () => {
    const currentUser: AuthUser = {
      uid: 'user-1',
      email: 'admin@hospital.cl',
      displayName: 'Admin',
      role: 'admin',
    };
    mockUseAuth.mockReturnValue(
      createAuthState({
        currentUser,
        authorizedUser: currentUser,
        user: currentUser,
        role: 'admin',
        isAuthenticated: true,
        isAuthorizedSession: true,
        isEditor: true,
        isViewer: false,
        isFirebaseConnected: true,
        remoteSyncStatus: 'ready',
      })
    );

    renderHook(() => useAppBootstrapState());

    expect(mockSetFirestoreSyncState).toHaveBeenCalledWith({
      mode: 'bootstrapping',
      reason: 'auth_connecting',
    });

    mockGetOptionalDb.mockReturnValue({ name: 'db' } as never);

    await waitFor(() =>
      expect(mockSetFirestoreSyncState).toHaveBeenCalledWith({
        mode: 'enabled',
        reason: 'ready',
      })
    );
  });

  it('buildAppBootstrapState prioritizes signature mode over the other gates', () => {
    const auth = createAuthState({
      isLoading: true,
      isAuthenticated: false,
    });
    const dateNav = createDateNavigation();

    const result = buildAppBootstrapState({
      auth,
      dateNav,
      isSignatureMode: true,
      currentDateString: '2026-03-27',
    });

    expect(result.status).toBe('signature_mode');
  });

  it('buildAppBootstrapState returns authenticated navigation wiring when access is ready', () => {
    const currentUser: AuthUser = {
      uid: 'user-1',
      email: 'admin@hospital.cl',
      displayName: 'Admin',
      role: 'admin',
    };
    const auth = createAuthState({
      currentUser,
      authorizedUser: currentUser,
      user: currentUser,
      role: 'admin',
      isAuthenticated: true,
      isAuthorizedSession: true,
      isEditor: true,
      isViewer: false,
    });
    const dateNav = createDateNavigation();

    const result = buildAppBootstrapState({
      auth,
      dateNav,
      isSignatureMode: false,
      currentDateString: '2026-03-31',
    });

    expect(result.status).toBe('authenticated');
    if (result.status === 'authenticated') {
      expect(result.dateNav.currentDateString).toBe('2026-03-31');
      expect(result.dateNav.selectedDay).toBe(27);
    }
  });
});
