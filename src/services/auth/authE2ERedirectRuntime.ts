import type { AuthUser } from '@/types/authRoleTypes';

const canUseE2EStorage = (): boolean =>
  typeof window !== 'undefined' &&
  !!window.localStorage &&
  (import.meta.env.VITE_E2E_MODE === 'true' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1');

const readE2EStorageValue = (key: string): string | null => {
  if (!canUseE2EStorage()) return null;
  return window.localStorage.getItem(key);
};

const removeE2EStorageValue = (key: string): void => {
  if (!canUseE2EStorage()) return;
  window.localStorage.removeItem(key);
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
