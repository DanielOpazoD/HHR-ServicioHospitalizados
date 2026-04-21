import { isAdministratorEmail } from '@/constants/identities';
import { isAdminAppRole } from '@/shared/access/operationalAccessPolicy';
import type { UserRole } from '@/types/auth';

export type AuditAdminAccessSource = 'none' | 'role' | 'email_fallback' | 'role_and_email';

export interface AuditAdminAccessResolution {
  isAdminByRole: boolean;
  isAdminByEmail: boolean;
  effectiveAdmin: boolean;
  hasAdminSourceMismatch: boolean;
  source: AuditAdminAccessSource;
}

export const resolveAuditAdminAccess = ({
  role,
  email,
}: {
  role: UserRole | undefined;
  email?: string | null;
}): AuditAdminAccessResolution => {
  const isAdminByRole = isAdminAppRole(role);
  const isAdminByEmail = isAdministratorEmail(email);
  const effectiveAdmin = isAdminByRole || isAdminByEmail;

  let source: AuditAdminAccessSource = 'none';
  if (isAdminByRole && isAdminByEmail) {
    source = 'role_and_email';
  } else if (isAdminByRole) {
    source = 'role';
  } else if (isAdminByEmail) {
    source = 'email_fallback';
  }

  return {
    isAdminByRole,
    isAdminByEmail,
    effectiveAdmin,
    hasAdminSourceMismatch: isAdminByRole !== isAdminByEmail,
    source,
  };
};
