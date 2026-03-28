import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockUseAuth,
  mockUseDateNavigation,
  mockUseSignatureMode,
  mockUseStorageMigration,
  mockUseVersionCheck,
  mockSetFirestoreEnabled,
} = vi.hoisted(() => ({
  mockUseAuth: vi.fn(),
  mockUseDateNavigation: vi.fn(),
  mockUseSignatureMode: vi.fn(),
  mockUseStorageMigration: vi.fn(),
  mockUseVersionCheck: vi.fn(),
  mockSetFirestoreEnabled: vi.fn(),
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
  setFirestoreEnabled: (...args: unknown[]) => mockSetFirestoreEnabled(...args),
}));

import { useAppBootstrapState } from '@/app-shell/bootstrap/useAppBootstrapState';

const createAuthState = (overrides: Record<string, unknown> = {}) => ({
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
  signOut: vi.fn(),
  ...overrides,
});

const createDateNavigation = (overrides: Record<string, unknown> = {}) => ({
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
      })
    );

    const { result } = renderHook(() => useAppBootstrapState());

    expect(result.current.status).toBe('loading');
    expect(mockUseStorageMigration).toHaveBeenCalledWith({ enabled: false });
    expect(mockUseVersionCheck).toHaveBeenCalledTimes(1);
    expect(mockUseSignatureMode).toHaveBeenCalledWith('2026-03-27', null, true);
    await waitFor(() => {
      expect(mockSetFirestoreEnabled).toHaveBeenCalledWith(true);
    });
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
  });

  it('returns authenticated with the resolved app date navigation', () => {
    const currentUser = {
      uid: 'user-1',
      email: 'admin@hospital.cl',
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
      })
    );
    mockUseSignatureMode.mockReturnValue({
      isSignatureMode: false,
      signatureDate: null,
      currentDateString: '2026-03-31',
    });

    const { result } = renderHook(() => useAppBootstrapState());

    expect(result.current.status).toBe('authenticated');
    if (result.current.status === 'authenticated') {
      expect(result.current.dateNav.currentDateString).toBe('2026-03-31');
      expect(result.current.dateNav.isSignatureMode).toBe(false);
    }
    expect(mockUseStorageMigration).toHaveBeenCalledWith({ enabled: true });
    expect(mockUseSignatureMode).toHaveBeenCalledWith('2026-03-27', currentUser, false);
  });
});
