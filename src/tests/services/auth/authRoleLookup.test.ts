import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFunctionsInstanceMock = vi.fn();
const httpsCallableMock = vi.fn();

vi.mock('@/firebaseConfig', () => ({
  getFunctionsInstance: () => getFunctionsInstanceMock(),
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => httpsCallableMock(...args),
}));

import { getBootstrapRoleForEmail, getDynamicRoleForEmail } from '@/services/auth/authRoleLookup';

describe('authRoleLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFunctionsInstanceMock.mockResolvedValue({});
  });

  it('returns bootstrap admin for technical recovery emails', () => {
    expect(getBootstrapRoleForEmail('daniel.opazo@hospitalhangaroa.cl')).toBe('admin');
  });

  it('resolves the current user role through the callable backed by config/roles', async () => {
    const checkUserRoleCall = vi.fn().mockResolvedValue({
      data: { role: 'doctor_specialist' },
    });
    httpsCallableMock.mockReturnValue(checkUserRoleCall);

    await expect(getDynamicRoleForEmail('specialist@hospital.cl')).resolves.toBe(
      'doctor_specialist'
    );
    expect(checkUserRoleCall).toHaveBeenCalledWith({});
  });

  it('returns null when callable resolves an unauthorized role marker', async () => {
    const checkUserRoleCall = vi.fn().mockResolvedValue({
      data: { role: 'unauthorized' },
    });
    httpsCallableMock.mockReturnValue(checkUserRoleCall);

    await expect(getDynamicRoleForEmail('removed@hospital.cl')).resolves.toBeNull();
  });
});
