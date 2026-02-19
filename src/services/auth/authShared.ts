import { GoogleAuthProvider, User } from 'firebase/auth';
import { AuthUser, UserRole } from '@/types';
import { INSTITUTIONAL_ACCOUNTS } from '@/constants/identities';

export const STATIC_ROLES: Record<string, string> = {
  [INSTITUTIONAL_ACCOUNTS.NURSING]: 'nurse_hospital',
  [INSTITUTIONAL_ACCOUNTS.NURSING_ALT]: 'nurse_hospital',
  'daniel.opazo@hospitalhangaroa.cl': 'admin',
  'd.opazo.damiani@gmail.com': 'doctor_urgency',
};

export const ROLE_CACHE_PREFIX = 'hhr_role_cache_';

export const createAuthError = (code: string, message: string): Error & { code: string } =>
  Object.assign(new Error(message), { code });

export const toAuthUser = (user: User, role?: UserRole): AuthUser => ({
  uid: user.uid,
  email: user.email,
  displayName: user.displayName,
  photoURL: user.photoURL,
  ...(role ? { role } : {}),
});

export const normalizeEmail = (email: string): string => {
  if (!email) return '';
  return String(email).toLowerCase().replace(/\s+/g, '').trim();
};

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
