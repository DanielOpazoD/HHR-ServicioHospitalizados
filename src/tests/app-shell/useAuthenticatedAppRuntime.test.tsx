import { renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthContextType } from '@/context';
import type { AuthSessionState, AuthUser } from '@/types/auth';

const {
  mockUseAppState,
  mockUseCensusEmail,
  mockUseDailyRecord,
  mockUseExistingDaysQuery,
  mockUseFileOperations,
  mockUseSystemHealthReporter,
  mockResolveShiftNurseSignature,
} = vi.hoisted(() => ({
  mockUseAppState: vi.fn(),
  mockUseCensusEmail: vi.fn(),
  mockUseDailyRecord: vi.fn(),
  mockUseExistingDaysQuery: vi.fn(),
  mockUseFileOperations: vi.fn(),
  mockUseSystemHealthReporter: vi.fn(),
  mockResolveShiftNurseSignature: vi.fn(),
}));

vi.mock('@/hooks', () => ({
  useAppState: () => mockUseAppState(),
  useCensusEmail: (...args: unknown[]) => mockUseCensusEmail(...args),
  useDailyRecord: (...args: unknown[]) => mockUseDailyRecord(...args),
  useExistingDaysQuery: (...args: unknown[]) => mockUseExistingDaysQuery(...args),
  useFileOperations: (...args: unknown[]) => mockUseFileOperations(...args),
}));

vi.mock('@/hooks/admin/useSystemHealthReporter', () => ({
  useSystemHealthReporter: () => mockUseSystemHealthReporter(),
}));

vi.mock('@/services/staff/dailyRecordStaffing', () => ({
  resolveShiftNurseSignature: (...args: unknown[]) => mockResolveShiftNurseSignature(...args),
}));

import { useAuthenticatedAppRuntime } from '@/app-shell/runtime/useAuthenticatedAppRuntime';

const createAuthorizedUser = (): AuthUser => ({
  uid: 'user-1',
  email: 'admin@hospital.cl',
  displayName: 'Admin User',
  role: 'admin',
});

const createAuthState = (overrides: Partial<AuthContextType> = {}): AuthContextType => {
  const authorizedUser = createAuthorizedUser();
  const sessionState: AuthSessionState = { status: 'authorized', user: authorizedUser };

  return {
    sessionState,
    authRuntime: {} as never,
    currentUser: authorizedUser,
    authorizedUser,
    user: authorizedUser,
    role: 'admin',
    isLoading: false,
    isAuthenticated: true,
    isAuthorizedSession: true,
    isAnonymousSignature: false,
    isUnauthorized: false,
    isEditor: true,
    isViewer: false,
    isFirebaseConnected: true,
    signOut: vi.fn(),
    ...overrides,
  };
};

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
  isSignatureMode: false,
  ...overrides,
});

describe('useAuthenticatedAppRuntime', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockUseDailyRecord.mockReturnValue({
      record: { date: '2026-03-27', beds: {} },
      refresh: vi.fn(),
    });
    mockUseExistingDaysQuery.mockReturnValue({ data: [1, 4, 8] });
    mockResolveShiftNurseSignature.mockReturnValue('Night Nurse');
    mockUseCensusEmail.mockReturnValue({ sendEmail: vi.fn(), status: 'idle' });
    mockUseFileOperations.mockReturnValue({ handleExportJSON: vi.fn() });
    mockUseAppState.mockReturnValue({ currentModule: 'CENSUS' });
  });

  it('builds the authenticated runtime and preserves the current wiring inputs', () => {
    const auth = createAuthState();
    const dateNav = createDateNavigation();

    const { result } = renderHook(() => useAuthenticatedAppRuntime({ auth, dateNav }));

    expect(mockUseSystemHealthReporter).toHaveBeenCalledTimes(1);
    expect(mockUseDailyRecord).toHaveBeenCalledWith('2026-03-27', false, true);
    expect(mockUseExistingDaysQuery).toHaveBeenCalledWith(2026, 2);
    expect(mockResolveShiftNurseSignature).toHaveBeenCalledWith(
      mockUseDailyRecord.mock.results[0]?.value.record,
      'night'
    );
    expect(mockUseCensusEmail).toHaveBeenCalledWith({
      record: mockUseDailyRecord.mock.results[0]?.value.record,
      currentDateString: '2026-03-27',
      nurseSignature: 'Night Nurse',
      selectedYear: 2026,
      selectedMonth: 2,
      selectedDay: 27,
      user: auth.currentUser,
      role: auth.role,
    });
    expect(mockUseFileOperations).toHaveBeenCalledWith(
      mockUseDailyRecord.mock.results[0]?.value.record,
      mockUseDailyRecord.mock.results[0]?.value.refresh
    );
    expect(result.current.existingDaysInMonth).toEqual([1, 4, 8]);
    expect(result.current.nurseSignature).toBe('Night Nurse');
    expect(result.current.censusContextValue.dateNav.existingDaysInMonth).toEqual([1, 4, 8]);
    expect(result.current.censusContextValue.nurseSignature).toBe('Night Nurse');
  });

  it('defaults existing days to an empty list when the query has not resolved yet', () => {
    mockUseExistingDaysQuery.mockReturnValue({ data: undefined });

    const { result } = renderHook(() =>
      useAuthenticatedAppRuntime({
        auth: createAuthState(),
        dateNav: createDateNavigation(),
      })
    );

    expect(result.current.existingDaysInMonth).toEqual([]);
    expect(result.current.censusContextValue.dateNav.existingDaysInMonth).toEqual([]);
  });
});
