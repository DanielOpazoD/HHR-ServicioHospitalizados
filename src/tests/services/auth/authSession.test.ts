import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockOnAuthStateChanged,
  mockFirebaseSignOut,
  mockResolveFirebaseUserRole,
  mockCheckSharedCensusAccess,
  mockIsSharedCensusMode,
  mockClearRoleCacheForEmail,
  mockAuth,
} = vi.hoisted(() => ({
  mockOnAuthStateChanged: vi.fn(),
  mockFirebaseSignOut: vi.fn().mockResolvedValue(undefined),
  mockResolveFirebaseUserRole: vi.fn(),
  mockCheckSharedCensusAccess: vi.fn(),
  mockIsSharedCensusMode: vi.fn(),
  mockClearRoleCacheForEmail: vi.fn().mockResolvedValue(undefined),
  mockAuth: { currentUser: null as null | { email: string | null } },
}));
let authStateCallback: ((firebaseUser: unknown) => Promise<void> | void) | null = null;

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: (...args: unknown[]) => mockOnAuthStateChanged(...args),
  signOut: (...args: unknown[]) => mockFirebaseSignOut(...args),
  GoogleAuthProvider: class {
    setCustomParameters() {}
  },
}));

vi.mock('@/firebaseConfig', () => ({
  auth: mockAuth,
  getFunctionsInstance: vi.fn().mockReturnValue({}),
}));

vi.mock('@/services/auth/sharedCensusAuth', () => ({
  checkSharedCensusAccess: (email: string | null) => mockCheckSharedCensusAccess(email),
  isSharedCensusMode: () => mockIsSharedCensusMode(),
}));

vi.mock('@/services/auth/authPolicy', () => ({
  clearRoleCacheForEmail: (email: string) => mockClearRoleCacheForEmail(email),
}));

vi.mock('@/services/auth/authClaimSyncService', () => ({
  ensureUserRoleClaim: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/services/auth/authAccessResolution', () => ({
  resolveFirebaseUserRole: (user: unknown) => mockResolveFirebaseUserRole(user),
}));

import { onAuthSessionStateChange } from '@/services/auth/authSession';
import { ensureUserRoleClaim } from '@/services/auth/authClaimSyncService';

const flushObserverRegistration = async (): Promise<void> => {
  await Promise.resolve();
};

const createFirebaseUserMock = (overrides: Record<string, unknown>) => ({
  uid: 'user-1',
  email: 'user@hospital.cl',
  displayName: 'User',
  photoURL: null,
  isAnonymous: false,
  getIdTokenResult: vi.fn().mockResolvedValue({ claims: {} }),
  ...overrides,
});

describe('authSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
    mockIsSharedCensusMode.mockReturnValue(false);
    mockCheckSharedCensusAccess.mockResolvedValue({ authorized: false });
    mockResolveFirebaseUserRole.mockResolvedValue('doctor_specialist');
    mockOnAuthStateChanged.mockImplementation((_auth, callback) => {
      authStateCallback = callback as (firebaseUser: unknown) => Promise<void> | void;
      return vi.fn();
    });
  });

  it('emits the authorized session state for general-login roles during auth state rehydration', async () => {
    const callback = vi.fn();
    onAuthSessionStateChange(callback);
    await flushObserverRegistration();

    await authStateCallback?.(
      createFirebaseUserMock({
        uid: 'spec-1',
        email: 'specialist@hospital.cl',
        displayName: 'Specialist User',
      })
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'authorized',
        user: expect.objectContaining({
          uid: 'spec-1',
          role: 'doctor_specialist',
        }),
      })
    );
  });

  it('does not block auth callback while claim sync is still pending', async () => {
    let releaseClaimSync: (() => void) | undefined;
    vi.mocked(ensureUserRoleClaim).mockImplementationOnce(
      () =>
        new Promise<void>(resolve => {
          releaseClaimSync = resolve;
        })
    );

    const callback = vi.fn();
    onAuthSessionStateChange(callback);
    await flushObserverRegistration();

    await authStateCallback?.(
      createFirebaseUserMock({
        uid: 'spec-1',
        email: 'specialist@hospital.cl',
        displayName: 'Specialist User',
      })
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'authorized',
        user: expect.objectContaining({
          uid: 'spec-1',
          role: 'doctor_specialist',
        }),
      })
    );

    releaseClaimSync?.();
  });

  it('emits explicit shared-census session state during auth state rehydration', async () => {
    const callback = vi.fn();
    mockIsSharedCensusMode.mockReturnValue(true);
    mockCheckSharedCensusAccess.mockResolvedValue({ authorized: true });

    onAuthSessionStateChange(callback);
    await flushObserverRegistration();

    await authStateCallback?.(
      createFirebaseUserMock({
        uid: 'shared-1',
        email: 'shared@hospital.cl',
        displayName: 'Shared User',
      })
    );

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'shared_census',
        user: expect.objectContaining({
          uid: 'shared-1',
          role: 'viewer_census',
        }),
      })
    );
  });

  it('emits unauthorized session state for a removed user', async () => {
    const callback = vi.fn();
    mockResolveFirebaseUserRole.mockResolvedValue(null);
    onAuthSessionStateChange(callback);
    await flushObserverRegistration();

    await authStateCallback?.(
      createFirebaseUserMock({
        uid: 'removed-1',
        email: 'removed@hospital.cl',
        displayName: 'Removed User',
      })
    );

    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'unauthorized',
      })
    );
  });

  it('emits anonymous signature session state explicitly', async () => {
    const callback = vi.fn();
    onAuthSessionStateChange(callback);
    await flushObserverRegistration();

    await authStateCallback?.(
      createFirebaseUserMock({
        uid: 'anon-1',
        email: null,
        displayName: null,
        isAnonymous: true,
      })
    );

    expect(mockResolveFirebaseUserRole).not.toHaveBeenCalled();
    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'anonymous_signature',
        user: expect.objectContaining({
          uid: 'anon-1',
          role: 'viewer',
        }),
      })
    );
  });
});
