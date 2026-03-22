import { AUTH_BOOTSTRAP_PENDING_TTL_MS } from '@/services/auth/authBootstrapBudgets';

const AUTH_BOOTSTRAP_PENDING_KEY = 'hhr_auth_bootstrap_pending_v1';

type AuthBootstrapState = {
  startedAt: number;
  mode: 'redirect';
  returnTo: string | null;
};

const resolveCurrentReturnTo = (): string | null => {
  if (typeof window === 'undefined') return null;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
};

const readState = (): AuthBootstrapState | null => {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  const raw = window.localStorage.getItem(AUTH_BOOTSTRAP_PENDING_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<AuthBootstrapState>;
    if (parsed.mode !== 'redirect' || typeof parsed.startedAt !== 'number') {
      return null;
    }

    if (Date.now() - parsed.startedAt > AUTH_BOOTSTRAP_PENDING_TTL_MS) {
      window.localStorage.removeItem(AUTH_BOOTSTRAP_PENDING_KEY);
      return null;
    }

    return {
      startedAt: parsed.startedAt,
      mode: parsed.mode,
      returnTo: typeof parsed.returnTo === 'string' ? parsed.returnTo : null,
    };
  } catch {
    return null;
  }
};

export const markAuthBootstrapPending = (
  mode: 'redirect' = 'redirect',
  returnTo: string | null = resolveCurrentReturnTo()
): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  const payload: AuthBootstrapState = {
    startedAt: Date.now(),
    mode,
    returnTo,
  };
  window.localStorage.setItem(AUTH_BOOTSTRAP_PENDING_KEY, JSON.stringify(payload));
};

export const isAuthBootstrapPending = (): boolean => Boolean(readState());

export const getAuthBootstrapPendingAgeMs = (): number => {
  const state = readState();
  if (!state) return 0;
  return Math.max(0, Date.now() - state.startedAt);
};

export const restoreAuthBootstrapReturnTo = (): void => {
  const state = readState();
  if (!state?.returnTo || typeof window === 'undefined') return;

  const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  if (current === state.returnTo) return;

  window.history.replaceState(window.history.state, '', state.returnTo);
};

export const clearAuthBootstrapPending = (): void => {
  if (typeof window === 'undefined' || !window.localStorage) return;
  window.localStorage.removeItem(AUTH_BOOTSTRAP_PENDING_KEY);
};
