import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createAuthHelpers } = require('../../../functions/lib/auth/authHelpersFactory.js');

const createAdminStub = (options: { dynamicRoles?: Record<string, string> }) => {
  const dynamicRoles = options.dynamicRoles ?? null;
  const setRoleDoc = vi.fn().mockResolvedValue(undefined);

  return {
    admin: {
      firestore: () => ({
        collection: (name: string) => ({
          doc: (id: string) => ({
            get: async () => {
              if (name === 'config' && id === 'roles') {
                return {
                  exists: !!dynamicRoles,
                  data: () => dynamicRoles ?? {},
                };
              }
              return { exists: false, data: () => ({}) };
            },
            set: setRoleDoc,
          }),
        }),
      }),
      auth: () => ({
        setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
      }),
    },
    setRoleDoc,
  };
};

describe('functions authHelpersFactory', () => {
  it('resolves dynamic roles before static allowlists and writes back canonical aliases', async () => {
    const { admin, setRoleDoc } = createAdminStub({
      dynamicRoles: { 'custom@example.com': 'viewer_census' },
    });
    const helpers = createAuthHelpers(admin);

    await expect(helpers.resolveRoleForEmail('custom@example.com')).resolves.toBe('viewer');
    expect(setRoleDoc).toHaveBeenCalledWith({ 'custom@example.com': 'viewer' });
  });

  it('treats doctor_specialist as valid general login access in callable helpers', async () => {
    const { admin } = createAdminStub({
      dynamicRoles: { 'specialist@example.com': 'doctor_specialist' },
    });
    const helpers = createAuthHelpers(admin);

    await expect(
      helpers.hasCallableClinicalAccess({
        auth: {
          token: {
            email: 'specialist@example.com',
          },
        },
      })
    ).resolves.toBe(true);
  });

  it('normalizes viewer_census to viewer for callable helpers', async () => {
    const { admin, setRoleDoc } = createAdminStub({
      dynamicRoles: { 'shared@example.com': 'viewer_census' },
    });
    const helpers = createAuthHelpers(admin);

    await expect(
      helpers.hasCallableClinicalAccess({
        auth: {
          token: {
            email: 'shared@example.com',
          },
        },
      })
    ).resolves.toBe(true);
    expect(setRoleDoc).toHaveBeenCalledWith({ 'shared@example.com': 'viewer' });
  });
});
