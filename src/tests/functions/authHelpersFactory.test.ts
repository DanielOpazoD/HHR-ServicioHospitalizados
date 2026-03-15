import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const { createAuthHelpers } = require('../../../functions/lib/auth/authHelpersFactory.js');

const createAdminStub = (options: {
  dynamicRoles?: Record<string, string>;
  censusDoc?: { exists: boolean; data?: () => Record<string, unknown> };
}) => {
  const dynamicRoles = options.dynamicRoles ?? null;
  const censusDoc = options.censusDoc ?? { exists: false, data: () => ({}) };

  return {
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
            if (name === 'census-authorized-emails') {
              return censusDoc;
            }
            return { exists: false, data: () => ({}) };
          },
        }),
      }),
    }),
    auth: () => ({
      setCustomUserClaims: vi.fn().mockResolvedValue(undefined),
    }),
  };
};

describe('functions authHelpersFactory', () => {
  it('resolves dynamic roles before static allowlists', async () => {
    const helpers = createAuthHelpers(
      createAdminStub({
        dynamicRoles: { 'custom@example.com': 'viewer_census' },
      })
    );

    await expect(helpers.resolveRoleForEmail('custom@example.com')).resolves.toBe('viewer_census');
  });

  it('authorizes shared census emails from dynamic store with downloader role', async () => {
    const helpers = createAuthHelpers(
      createAdminStub({
        censusDoc: {
          exists: true,
          data: () => ({ role: 'downloader' }),
        },
      })
    );

    await expect(helpers.isSharedCensusEmailAuthorized('reader@example.com')).resolves.toEqual({
      authorized: true,
      role: 'downloader',
    });
  });

  it('treats doctor_specialist as valid general login access in callable helpers', async () => {
    const helpers = createAuthHelpers(
      createAdminStub({
        dynamicRoles: { 'specialist@example.com': 'doctor_specialist' },
      })
    );

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

  it('does not treat viewer_census as general login access in callable helpers', async () => {
    const helpers = createAuthHelpers(
      createAdminStub({
        dynamicRoles: { 'shared@example.com': 'viewer_census' },
      })
    );

    await expect(
      helpers.hasCallableClinicalAccess({
        auth: {
          token: {
            email: 'shared@example.com',
          },
        },
      })
    ).resolves.toBe(false);
  });
});
