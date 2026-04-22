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
