import { httpsCallable } from 'firebase/functions';
import { UserRole } from '@/types/auth';
import { BOOTSTRAP_ADMIN_EMAILS, normalizeEmail } from '@/services/auth/authShared';
import { isGeneralLoginRole } from '@/shared/access/roleAccessMatrix';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';

type CheckUserRoleResponse = {
  role?: string;
};

export const getBootstrapRoleForEmail = (email: string): UserRole | null => {
  const cleanEmail = normalizeEmail(email);

  if (
    (BOOTSTRAP_ADMIN_EMAILS as readonly string[]).some(
      staticEmail => cleanEmail === normalizeEmail(staticEmail)
    )
  ) {
    return 'admin';
  }

  return null;
};

export const getDynamicRoleForEmail = async (email: string): Promise<UserRole | null> => {
  try {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return null;

    const functions = await defaultFunctionsRuntime.getFunctions();
    const checkUserRole = httpsCallable<Record<string, never>, CheckUserRoleResponse>(
      functions,
      'checkUserRole'
    );
    const response = await checkUserRole({});
    const role = response.data?.role;
    if (!isGeneralLoginRole(role)) {
      return null;
    }
    return role;
  } catch {
    return null;
  }
};
