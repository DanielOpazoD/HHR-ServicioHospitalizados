import { createRequire } from 'node:module';
import { describe, expect, it, vi } from 'vitest';

vi.mock('firebase-functions/v1', () => ({
  https: {
    HttpsError: class HttpsError extends Error {
      code: string;

      constructor(code: string, message: string) {
        super(message);
        this.code = code;
      }
    },
  },
}));

const require = createRequire(import.meta.url);
const {
  assertAssignableRole,
  assertRoleMutationAccess,
  parseRoleMutationRequest,
} = require('../../../functions/lib/auth/authCallablePolicy.js');

describe('functions authCallablePolicy', () => {
  it('parses raw role mutation input defensively', () => {
    expect(parseRoleMutationRequest({ email: 'user@example.com', role: 'admin' })).toEqual({
      rawEmail: 'user@example.com',
      rawRole: 'admin',
    });
    expect(parseRoleMutationRequest({})).toEqual({
      rawEmail: '',
      rawRole: '',
    });
  });

  it('allows role mutation for bootstrap admins and rejects invalid roles', () => {
    expect(() =>
      assertRoleMutationAccess({
        context: { auth: { token: { email: 'admin@example.com' } } },
        callerEmail: 'admin@example.com',
        adminEmails: ['admin@example.com'],
      })
    ).not.toThrow();

    expect(() => assertAssignableRole('user@example.com', 'not-a-role')).toThrow(/Invalid role/);
  });
});
