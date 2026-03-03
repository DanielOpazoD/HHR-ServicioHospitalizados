import { createRequire } from 'node:module';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  https: {
    onCall: (handler: (data: unknown, context: unknown) => unknown) => ({ run: handler }),
    HttpsError: class HttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
  },
  auth: {
    user: () => ({
      onCreate: (handler: (user: unknown) => unknown) => ({ run: handler }),
    }),
  },
}));

const require = createRequire(import.meta.url);
const { createAuthFunctions } = require('../../../functions/lib/auth/authFunctionsFactory.js');

describe('functions authFunctionsFactory', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects role mutation without admin access', async () => {
    const functionsApi = createAuthFunctions({
      admin: {
        auth: () => ({
          getUserByEmail: vi.fn(),
          setCustomUserClaims: vi.fn(),
        }),
        firestore: () => ({
          collection: () => ({
            doc: () => ({
              set: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      },
      helpers: {
        normalizeEmail: (value: unknown) => String(value || '').toLowerCase(),
        adminEmails: [],
      },
    });

    await expect(functionsApi.setUserRole.run({}, { auth: null })).rejects.toMatchObject({
      code: 'permission-denied',
    });
  });

  it('delegates user creation role assignment to helper', async () => {
    const assignRole = vi.fn().mockResolvedValue('admin');
    const functionsApi = createAuthFunctions({
      admin: {
        auth: () => ({
          getUserByEmail: vi.fn(),
          setCustomUserClaims: vi.fn(),
        }),
        firestore: () => ({
          collection: () => ({
            doc: () => ({
              set: vi.fn().mockResolvedValue(undefined),
            }),
          }),
        }),
      },
      helpers: {
        assignRole,
        normalizeEmail: (value: unknown) => String(value || '').toLowerCase(),
        adminEmails: [],
        resolveRoleForEmail: vi.fn(),
        isSharedCensusEmailAuthorized: vi.fn(),
      },
    });

    await expect(
      functionsApi.onUserCreated.run({ uid: 'u1', email: 'user@example.com' })
    ).resolves.toBe('admin');
    expect(assignRole).toHaveBeenCalledWith({ uid: 'u1', email: 'user@example.com' });
  });
});
