import { describe, expect, it, vi } from 'vitest';

import { resolveAuthSessionUser, toAnonymousAuthUser } from '@/services/auth/authSessionController';

describe('authSessionController', () => {
  it('maps anonymous users to viewer auth users', () => {
    expect(
      toAnonymousAuthUser({
        uid: 'anon-1',
      } as never)
    ).toEqual({
      uid: 'anon-1',
      email: null,
      displayName: 'Anonymous Doctor',
      role: 'viewer',
    });
  });

  it('returns viewer_census for authorized shared-census users', async () => {
    const result = await resolveAuthSessionUser(
      {
        uid: 'user-1',
        email: 'shared@hospital.cl',
        isAnonymous: false,
        displayName: 'Shared User',
        photoURL: null,
      } as never,
      {
        isSharedCensusMode: () => true,
        isSpecialistMedicalHandoffMode: () => false,
        checkSharedCensusAccess: vi.fn().mockResolvedValue({ authorized: true }),
        canAccessSpecialistMedicalHandoff: vi.fn().mockReturnValue(false),
        signOutUnauthorizedUser: vi.fn(),
        resolveFirebaseUserRole: vi.fn().mockResolvedValue('admin'),
      }
    );

    expect(result).toEqual(
      expect.objectContaining({
        uid: 'user-1',
        role: 'viewer_census',
      })
    );
  });

  it('signs out unauthorized shared-census users', async () => {
    const signOutUnauthorizedUser = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthSessionUser(
      {
        uid: 'user-2',
        email: 'blocked@hospital.cl',
        isAnonymous: false,
      } as never,
      {
        isSharedCensusMode: () => true,
        isSpecialistMedicalHandoffMode: () => false,
        checkSharedCensusAccess: vi.fn().mockResolvedValue({ authorized: false }),
        canAccessSpecialistMedicalHandoff: vi.fn().mockReturnValue(false),
        signOutUnauthorizedUser,
        resolveFirebaseUserRole: vi.fn(),
      }
    );

    expect(result).toBeNull();
    expect(signOutUnauthorizedUser).toHaveBeenCalledTimes(1);
  });

  it('signs out non-specialist users in specialist medical handoff mode', async () => {
    const signOutUnauthorizedUser = vi.fn().mockResolvedValue(undefined);

    const result = await resolveAuthSessionUser(
      {
        uid: 'user-3',
        email: 'doctor@hospital.cl',
        isAnonymous: false,
      } as never,
      {
        isSharedCensusMode: () => false,
        isSpecialistMedicalHandoffMode: () => true,
        checkSharedCensusAccess: vi.fn().mockResolvedValue({ authorized: false }),
        canAccessSpecialistMedicalHandoff: vi.fn().mockReturnValue(false),
        signOutUnauthorizedUser,
        resolveFirebaseUserRole: vi.fn().mockResolvedValue('doctor_urgency'),
      }
    );

    expect(result).toBeNull();
    expect(signOutUnauthorizedUser).toHaveBeenCalledTimes(1);
  });
});
