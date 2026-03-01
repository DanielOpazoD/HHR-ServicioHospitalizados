const RECENT_MANUAL_LOGOUT_KEY = 'hhr_recent_manual_logout_v1';
const RECENT_MANUAL_LOGOUT_TTL_MS = 120_000;

type ManualLogoutState = {
  reason: 'manual';
  at: number;
};

const readManualLogoutState = (): ManualLogoutState | null => {
  if (typeof window === 'undefined' || !window.sessionStorage) return null;

  const raw = window.sessionStorage.getItem(RECENT_MANUAL_LOGOUT_KEY);
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<ManualLogoutState>;
    if (parsed.reason !== 'manual' || typeof parsed.at !== 'number') {
      window.sessionStorage.removeItem(RECENT_MANUAL_LOGOUT_KEY);
      return null;
    }

    if (Date.now() - parsed.at > RECENT_MANUAL_LOGOUT_TTL_MS) {
      window.sessionStorage.removeItem(RECENT_MANUAL_LOGOUT_KEY);
      return null;
    }

    return { reason: 'manual', at: parsed.at };
  } catch {
    window.sessionStorage.removeItem(RECENT_MANUAL_LOGOUT_KEY);
    return null;
  }
};

export const markRecentManualLogout = (): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  const payload: ManualLogoutState = {
    reason: 'manual',
    at: Date.now(),
  };
  window.sessionStorage.setItem(RECENT_MANUAL_LOGOUT_KEY, JSON.stringify(payload));
};

export const hasRecentManualLogout = (): boolean => Boolean(readManualLogoutState());

export const clearRecentManualLogout = (): void => {
  if (typeof window === 'undefined' || !window.sessionStorage) return;
  window.sessionStorage.removeItem(RECENT_MANUAL_LOGOUT_KEY);
};
