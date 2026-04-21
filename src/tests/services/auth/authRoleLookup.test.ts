import { beforeEach, describe, expect, it, vi } from 'vitest';

const getFunctionsMock = vi.fn();
const httpsCallableMock = vi.fn();

vi.mock('@/services/firebase-runtime/functionsRuntime', () => ({
  defaultFunctionsRuntime: {
    getFunctions: (...args: unknown[]) => getFunctionsMock(...args),
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: (...args: unknown[]) => httpsCallableMock(...args),
}));

import {
  AUTH_ROLE_LOOKUP_UNAVAILABLE_CODE,
  createAuthRoleLookupService,
  getDynamicRoleForEmail,
  resolveCallableRole,
} from '@/services/auth/authRoleLookup';

describe('authRoleLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getFunctionsMock.mockResolvedValue({});
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

  it('normalizes malformed callable payloads to null without leaking ambiguity', () => {
    expect(resolveCallableRole(undefined)).toBeNull();
    expect(resolveCallableRole({ role: null })).toBeNull();
    expect(resolveCallableRole({ role: 'viewer' })).toBe('viewer');
  });

  it('throws an explicit unavailable error when the callable cannot be reached', async () => {
    const checkUserRoleCall = vi.fn().mockRejectedValue(new Error('network down'));
    httpsCallableMock.mockReturnValue(checkUserRoleCall);

    await expect(getDynamicRoleForEmail('specialist@hospital.cl')).rejects.toMatchObject({
      code: AUTH_ROLE_LOOKUP_UNAVAILABLE_CODE,
    });
  });

  it('supports injected functions runtimes', async () => {
    const checkUserRoleCall = vi.fn().mockResolvedValue({
      data: { role: 'viewer' },
    });
    httpsCallableMock.mockReturnValue(checkUserRoleCall);
    const service = createAuthRoleLookupService({
      getFunctions: vi.fn().mockResolvedValue({ custom: true } as never),
    });

    await expect(service.getDynamicRoleForEmail('viewer@hospital.cl')).resolves.toBe('viewer');
  });
});
