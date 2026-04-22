import type { UserRole } from '@/types/authRoleTypes';

export interface AuthRoleLookupDependencies {
  getDynamicRoleForEmail(email: string): Promise<UserRole | null>;
}

export type AuthRoleResolutionSource = 'dynamic' | 'none';

export interface AuthRoleResolutionResult {
  role: UserRole | null;
  source: AuthRoleResolutionSource;
}

export const resolveAllowedRoleForEmail = async (
  email: string,
  dependencies: AuthRoleLookupDependencies
): Promise<AuthRoleResolutionResult> => {
  const dynamicRole = await dependencies.getDynamicRoleForEmail(email);
  if (dynamicRole) {
    return { role: dynamicRole, source: 'dynamic' };
  }

  return { role: null, source: 'none' };
};
