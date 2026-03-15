import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  authorizeCurrentFirebaseUser,
  authorizeFirebaseUser,
} from '@/services/auth/authAccessResolution';

const {
  mockFirebaseSignOut,
  mockCheckSharedCensusAccess,
  mockIsSharedCensusMode,
  mockCheckEmailInFirestore,
  mockAuth,
  mockToAuthUser,
} = vi.hoisted(() => ({
  mockFirebaseSignOut: vi.fn().mockResolvedValue(undefined),
  mockCheckSharedCensusAccess: vi.fn(),
  mockIsSharedCensusMode: vi.fn(),
  mockCheckEmailInFirestore: vi.fn(),
  mockAuth: {
    currentUser: null as null | { uid: string; email: string | null; isAnonymous?: boolean },
  },
  mockToAuthUser: vi.fn((user: { uid: string; email: string | null }, role?: string) => ({
    uid: user.uid,
    email: user.email,
    role,
  })),
}));

vi.mock('firebase/auth', () => ({
  signOut: () => mockFirebaseSignOut(),
}));

vi.mock('@/firebaseConfig', () => ({
  auth: mockAuth,
}));

vi.mock('@/services/auth/sharedCensusAuth', () => ({
  checkSharedCensusAccess: (email?: string | null) => mockCheckSharedCensusAccess(email),
  isSharedCensusMode: () => mockIsSharedCensusMode(),
}));

vi.mock('@/services/auth/authPolicy', () => ({
  checkEmailInFirestore: (email: string) => mockCheckEmailInFirestore(email),
}));

vi.mock('@/services/auth/authShared', () => ({
  toAuthUser: (user: { uid: string; email: string | null }, role?: string) =>
    mockToAuthUser(user, role),
}));

describe('authAccessResolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.currentUser = null;
    mockIsSharedCensusMode.mockReturnValue(false);
    mockCheckSharedCensusAccess.mockResolvedValue({ authorized: false });
    mockCheckEmailInFirestore.mockResolvedValue({ allowed: true, role: 'admin' });
  });

  it('authorizes doctor_specialist users in the standard login flow', async () => {
    mockCheckEmailInFirestore.mockResolvedValue({
      allowed: true,
      role: 'doctor_specialist',
    });

    const result = await authorizeFirebaseUser({
      uid: 'spec-1',
      email: 'specialist@hospital.cl',
    } as never);

    expect(result).toEqual({
      uid: 'spec-1',
      email: 'specialist@hospital.cl',
      role: 'doctor_specialist',
    });
    expect(mockFirebaseSignOut).not.toHaveBeenCalled();
  });

  it('signs out unauthorized users in the standard login flow', async () => {
    mockCheckEmailInFirestore.mockResolvedValue({ allowed: false, role: undefined });

    await expect(
      authorizeFirebaseUser({
        uid: 'doctor-1',
        email: 'doctor@hospital.cl',
      } as never)
    ).rejects.toThrow(/Acceso no autorizado/i);

    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });

  it('rehydrates an authorized current user without exposing an empty shell', async () => {
    mockAuth.currentUser = {
      uid: 'spec-2',
      email: 'specialist@hospital.cl',
      isAnonymous: false,
    };
    mockCheckEmailInFirestore.mockResolvedValue({
      allowed: true,
      role: 'doctor_specialist',
    });

    await expect(authorizeCurrentFirebaseUser()).resolves.toEqual({
      uid: 'spec-2',
      email: 'specialist@hospital.cl',
      role: 'doctor_specialist',
    });
  });

  it('returns null after sign-out when the rehydrated current user no longer has a role', async () => {
    mockAuth.currentUser = {
      uid: 'removed-1',
      email: 'removed@hospital.cl',
      isAnonymous: false,
    };
    mockCheckEmailInFirestore.mockResolvedValue({ allowed: false, role: undefined });

    await expect(authorizeCurrentFirebaseUser()).resolves.toBeNull();
    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });
});
