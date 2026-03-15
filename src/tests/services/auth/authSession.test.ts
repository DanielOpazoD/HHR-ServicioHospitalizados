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
}));

vi.mock('@/services/auth/sharedCensusAuth', () => ({
  checkSharedCensusAccess: (email: string | null) => mockCheckSharedCensusAccess(email),
  isSharedCensusMode: () => mockIsSharedCensusMode(),
}));

vi.mock('@/services/auth/authPolicy', () => ({
  clearRoleCacheForEmail: (email: string) => mockClearRoleCacheForEmail(email),
}));

vi.mock('@/services/auth/authAccessResolution', () => ({
  resolveFirebaseUserRole: (user: unknown) => mockResolveFirebaseUserRole(user),
}));

import { onAuthChange } from '@/services/auth/authSession';

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

  it('emits the authorized app user for general-login roles during auth state rehydration', async () => {
    const callback = vi.fn();
    onAuthChange(callback);

    await authStateCallback?.({
      uid: 'spec-1',
      email: 'specialist@hospital.cl',
      displayName: 'Specialist User',
      photoURL: null,
      isAnonymous: false,
    });

    expect(callback).toHaveBeenCalledWith(
      expect.objectContaining({
        uid: 'spec-1',
        role: 'doctor_specialist',
      })
    );
  });

  it('emits null for a removed user instead of exposing an app session', async () => {
    const callback = vi.fn();
    mockResolveFirebaseUserRole.mockResolvedValue(null);
    onAuthChange(callback);

    await authStateCallback?.({
      uid: 'removed-1',
      email: 'removed@hospital.cl',
      displayName: 'Removed User',
      photoURL: null,
      isAnonymous: false,
    });

    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith(null);
  });
});
