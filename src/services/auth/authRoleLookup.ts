import { httpsCallable } from 'firebase/functions';
import { UserRole } from '@/types';
import { getFunctionsInstance } from '@/firebaseConfig';
import { BOOTSTRAP_ADMIN_EMAILS, normalizeEmail } from '@/services/auth/authShared';

type CheckUserRoleResponse = {
  role?: string;
};

const VALID_LOGIN_ROLES = new Set<UserRole>([
  'admin',
  'nurse_hospital',
  'doctor_urgency',
  'doctor_specialist',
  'viewer',
  'editor',
]);

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

    const functions = await getFunctionsInstance();
    const checkUserRole = httpsCallable<Record<string, never>, CheckUserRoleResponse>(
      functions,
      'checkUserRole'
    );
    const response = await checkUserRole({});
    const role = response.data?.role;
    if (!role || !VALID_LOGIN_ROLES.has(role as UserRole)) {
      return null;
    }
    return role as UserRole;
  } catch {
    return null;
  }
};
