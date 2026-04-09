import { GoogleAuthProvider, User } from 'firebase/auth';
import { AuthUser, UserRole } from '@/types/auth';

// Client-side bootstrap admin emails — used only as a fast-path hint in
// getBootstrapRoleForEmail() so the UI can grant the admin role optimistically
// before the Cloud Function responds.  Actual access control is enforced
// server-side (Firestore/Storage rules + Cloud Functions).
// These CANNOT be read from env vars because they would be embedded in the
// bundle at build time, exposing them to any user.  The values here must
// match the server-side list in functions/lib/auth/authConfig.js.
export const BOOTSTRAP_ADMIN_EMAILS = [
  'daniel.opazo@hospitalhangaroa.cl',
  'd.opazo.damiani@gmail.com',
] as const;

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
