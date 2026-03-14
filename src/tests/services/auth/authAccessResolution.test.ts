import { beforeEach, describe, expect, it, vi } from 'vitest';

import { authorizeFirebaseUser } from '@/services/auth/authAccessResolution';

const mockFirebaseSignOut = vi.fn().mockResolvedValue(undefined);
const mockCheckSharedCensusAccess = vi.fn();
const mockIsSharedCensusMode = vi.fn();
const mockCheckEmailInFirestore = vi.fn();
const mockIsSpecialistMedicalHandoffMode = vi.fn();
const mockCanAccessSpecialistMedicalHandoff = vi.fn();
const mockToAuthUser = vi.fn((user: { uid: string; email: string | null }, role?: string) => ({
  uid: user.uid,
  email: user.email,
  role,
}));

vi.mock('firebase/auth', () => ({
  signOut: () => mockFirebaseSignOut(),
}));

vi.mock('@/firebaseConfig', () => ({
  auth: { currentUser: null },
}));

vi.mock('@/services/auth/sharedCensusAuth', () => ({
  checkSharedCensusAccess: (email?: string | null) => mockCheckSharedCensusAccess(email),
  isSharedCensusMode: () => mockIsSharedCensusMode(),
}));

vi.mock('@/services/auth/specialistMedicalHandoffAuth', () => ({
  isSpecialistMedicalHandoffMode: () => mockIsSpecialistMedicalHandoffMode(),
  canAccessSpecialistMedicalHandoff: (role?: string) => mockCanAccessSpecialistMedicalHandoff(role),
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
    mockIsSharedCensusMode.mockReturnValue(false);
    mockIsSpecialistMedicalHandoffMode.mockReturnValue(false);
    mockCanAccessSpecialistMedicalHandoff.mockReturnValue(false);
    mockCheckSharedCensusAccess.mockResolvedValue({ authorized: false });
    mockCheckEmailInFirestore.mockResolvedValue({ allowed: true, role: 'admin' });
  });

  it('authorizes doctor_specialist users in specialist medical handoff mode', async () => {
    mockIsSpecialistMedicalHandoffMode.mockReturnValue(true);
    mockCheckEmailInFirestore.mockResolvedValue({
      allowed: true,
      role: 'doctor_specialist',
    });
    mockCanAccessSpecialistMedicalHandoff.mockReturnValue(true);

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

  it('signs out non-specialist users when they enter the specialist mode link', async () => {
    mockIsSpecialistMedicalHandoffMode.mockReturnValue(true);
    mockCheckEmailInFirestore.mockResolvedValue({
      allowed: true,
      role: 'doctor_urgency',
    });
    mockCanAccessSpecialistMedicalHandoff.mockReturnValue(false);

    await expect(
      authorizeFirebaseUser({
        uid: 'doctor-1',
        email: 'doctor@hospital.cl',
      } as never)
    ).rejects.toThrow(/entrega médica de especialistas/i);

    expect(mockFirebaseSignOut).toHaveBeenCalledTimes(1);
  });
});
