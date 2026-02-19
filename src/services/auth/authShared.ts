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

const isE2EMode = import.meta.env.VITE_E2E_MODE === 'true';

const readE2EStorageValue = (key: string): string | null => {
  if (!isE2EMode || typeof window === 'undefined' || !window.localStorage) return null;
  return window.localStorage.getItem(key);
};

const removeE2EStorageValue = (key: string): void => {
  if (!isE2EMode || typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(key);
};

export const consumeE2EPopupErrorCode = (): string | null => {
  const code = readE2EStorageValue('hhr_e2e_popup_error_code');
  if (!code) return null;
  removeE2EStorageValue('hhr_e2e_popup_error_code');
  return code;
};

export const consumeE2EPopupMockUser = (): AuthUser | null => {
  const raw = readE2EStorageValue('hhr_e2e_popup_success_user');
  if (!raw) return null;
  removeE2EStorageValue('hhr_e2e_popup_success_user');

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.uid || !parsed.email) return null;
    return {
      uid: parsed.uid,
      email: parsed.email,
      displayName: parsed.displayName || 'E2E User',
      photoURL: parsed.photoURL || null,
      role: parsed.role || 'viewer',
    };
  } catch {
    return null;
  }
};

export const consumeE2EPopupDelayMs = (): number => {
  const raw = readE2EStorageValue('hhr_e2e_popup_delay_ms');
  if (!raw) return 0;
  removeE2EStorageValue('hhr_e2e_popup_delay_ms');

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(parsed, 10_000);
};

export const readE2ERedirectMode = (): 'success' | 'error' | 'timeout' | null => {
  const mode = readE2EStorageValue('hhr_e2e_redirect_mode');
  if (mode === 'success' || mode === 'error' || mode === 'timeout') return mode;
  return null;
};

export const consumeE2ERedirectPendingUser = (): AuthUser | null => {
  const raw = readE2EStorageValue('hhr_e2e_redirect_pending_user');
  if (!raw) return null;
  removeE2EStorageValue('hhr_e2e_redirect_pending_user');

  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed.uid || !parsed.email) return null;
    return {
      uid: parsed.uid,
      email: parsed.email,
      displayName: parsed.displayName || 'E2E Redirect User',
      photoURL: parsed.photoURL || null,
      role: parsed.role || 'viewer',
    };
  } catch {
    return null;
  }
};

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});
