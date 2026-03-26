import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocMock = vi.fn();
const setDocMock = vi.fn();

vi.mock('@/services/infrastructure/db', () => ({
  db: {
    getDoc: (...args: unknown[]) => getDocMock(...args),
    setDoc: (...args: unknown[]) => setDocMock(...args),
  },
}));

vi.mock('@/services/firebase-runtime/functionsRuntime', () => ({
  defaultFunctionsRuntime: {
    getFunctions: vi.fn(),
  },
}));

vi.mock('firebase/functions', () => ({
  httpsCallable: vi.fn(),
}));

import { roleService } from '@/services/admin/roleService';

describe('roleService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDocMock.mockResolvedValue({});
    setDocMock.mockResolvedValue(undefined);
  });

  it('normalizes legacy role aliases from config/roles and writes back the canonical map', async () => {
    getDocMock.mockResolvedValue({
      'legacy.viewer@hospital.cl': 'viewer_census',
      'editor@hospital.cl': 'editor',
    });

    await expect(roleService.getRolesSnapshot()).resolves.toEqual({
      roles: {
        'legacy.viewer@hospital.cl': 'viewer',
        'editor@hospital.cl': 'editor',
      },
      migratedLegacyEntries: ['legacy.viewer@hospital.cl'],
    });

    expect(setDocMock).toHaveBeenCalledWith('config', 'roles', {
      'legacy.viewer@hospital.cl': 'viewer',
      'editor@hospital.cl': 'editor',
    });
  });

  it('canonicalizes lingering legacy aliases before persisting a managed role mutation', async () => {
    getDocMock.mockResolvedValue({
      'legacy.viewer@hospital.cl': 'viewer_census',
      'editor@hospital.cl': 'editor',
    });

    await roleService.setRole('nurse@hospital.cl', 'nurse_hospital');

    expect(setDocMock).toHaveBeenCalledWith('config', 'roles', {
      'legacy.viewer@hospital.cl': 'viewer',
      'editor@hospital.cl': 'editor',
      'nurse@hospital.cl': 'nurse_hospital',
    });
  });
});
