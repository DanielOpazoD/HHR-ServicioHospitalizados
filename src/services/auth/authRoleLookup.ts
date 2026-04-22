import { httpsCallable } from 'firebase/functions';
import type { UserRole } from '@/types/authRoleTypes';
import { normalizeEmail } from '@/services/auth/authShared';
import { isGeneralLoginRole } from '@/shared/access/roleAccessMatrix';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';
import type { FunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';
import { createAuthError } from '@/services/auth/authShared';

type CheckUserRoleCallableData = {
  role?: string | null;
};

export const AUTH_ROLE_LOOKUP_UNAVAILABLE_CODE = 'auth/role-lookup-unavailable';

export const resolveCallableRole = (
  response: CheckUserRoleCallableData | null | undefined
): UserRole | null => {
  const role = response?.role ?? undefined;
  if (!isGeneralLoginRole(role)) {
    return null;
  }

  return role;
};

export const createAuthRoleLookupService = (
  functionsRuntime: Pick<FunctionsRuntime, 'getFunctions'> = defaultFunctionsRuntime
) => ({
  getDynamicRoleForEmail: async (email: string): Promise<UserRole | null> => {
    try {
      const cleanEmail = normalizeEmail(email);
      if (!cleanEmail) return null;

      const functions = await functionsRuntime.getFunctions();
      const checkUserRole = httpsCallable<Record<string, never>, CheckUserRoleCallableData>(
        functions,
        'checkUserRole'
      );
      const response = await checkUserRole({});
      return resolveCallableRole(response.data);
    } catch (error) {
      throw createAuthError(
        AUTH_ROLE_LOOKUP_UNAVAILABLE_CODE,
        error instanceof Error && error.message
          ? error.message
          : 'No se pudo consultar el rol actual del usuario.'
      );
    }
  },
});

const authRoleLookupService = createAuthRoleLookupService();
export const getDynamicRoleForEmail = authRoleLookupService.getDynamicRoleForEmail;
