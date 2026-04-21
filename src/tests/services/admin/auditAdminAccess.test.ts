import { describe, expect, it } from 'vitest';

import { resolveAuditAdminAccess } from '@/services/admin/auditAdminAccess';

describe('auditAdminAccess', () => {
  it('keeps admin capability when the role is canonical but the email is not hardcoded', () => {
    expect(
      resolveAuditAdminAccess({
        role: 'admin',
        email: 'someone-else@hospitalhangaroa.cl',
      })
    ).toEqual({
      isAdminByRole: true,
      isAdminByEmail: false,
      effectiveAdmin: true,
      hasAdminSourceMismatch: true,
      source: 'role',
    });
  });

  it('preserves the temporary email fallback while the migration remains active', () => {
    expect(
      resolveAuditAdminAccess({
        role: 'viewer',
        email: 'daniel.opazo@hospitalhangaroa.cl',
      })
    ).toEqual({
      isAdminByRole: false,
      isAdminByEmail: true,
      effectiveAdmin: true,
      hasAdminSourceMismatch: true,
      source: 'email_fallback',
    });
  });

  it('reports no mismatch when both sources agree on admin access', () => {
    expect(
      resolveAuditAdminAccess({
        role: 'admin',
        email: 'daniel.opazo@hospitalhangaroa.cl',
      })
    ).toEqual({
      isAdminByRole: true,
      isAdminByEmail: true,
      effectiveAdmin: true,
      hasAdminSourceMismatch: false,
      source: 'role_and_email',
    });
  });

  it('reports no admin access when neither source grants it', () => {
    expect(
      resolveAuditAdminAccess({
        role: 'viewer',
        email: 'viewer@hospitalhangaroa.cl',
      })
    ).toEqual({
      isAdminByRole: false,
      isAdminByEmail: false,
      effectiveAdmin: false,
      hasAdminSourceMismatch: false,
      source: 'none',
    });
  });
});
