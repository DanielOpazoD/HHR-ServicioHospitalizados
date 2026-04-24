export type LoginBackgroundMode = 'day' | 'night';

export const LOGIN_BACKGROUND_MODE_STORAGE_KEY = 'hhr_login_background_mode';

interface StoredLoginBackgroundMode {
  mode: LoginBackgroundMode;
  period: LoginBackgroundMode;
}

const isLoginBackgroundMode = (value: unknown): value is LoginBackgroundMode =>
  value === 'day' || value === 'night';

const parseStoredLoginBackgroundMode = (value: string | null): StoredLoginBackgroundMode | null => {
  if (!value) {
    return null;
  }

  if (isLoginBackgroundMode(value)) {
    return {
      mode: value,
      period: value,
    };
  }

  try {
    const parsed = JSON.parse(value) as Partial<StoredLoginBackgroundMode>;
    if (isLoginBackgroundMode(parsed.mode) && isLoginBackgroundMode(parsed.period)) {
      return {
        mode: parsed.mode,
        period: parsed.period,
      };
    }
  } catch {
    return null;
  }

  return null;
};

const readStoredLoginBackgroundMode = (
  currentPeriod: LoginBackgroundMode
): LoginBackgroundMode | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const storedMode = parseStoredLoginBackgroundMode(
      window.localStorage.getItem(LOGIN_BACKGROUND_MODE_STORAGE_KEY)
    );
    if (!storedMode || storedMode.period !== currentPeriod) {
      return null;
    }

    return storedMode.mode;
  } catch {
    return null;
  }
};

export const persistLoginBackgroundMode = (mode: LoginBackgroundMode): void => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(
      LOGIN_BACKGROUND_MODE_STORAGE_KEY,
      JSON.stringify({
        mode,
        period: resolveTimeBasedLoginBackgroundMode(),
      } satisfies StoredLoginBackgroundMode)
    );
  } catch {
    // Ignore storage failures; the visual toggle should still work in-memory.
  }
};

export const resolveTimeBasedLoginBackgroundMode = (date = new Date()): LoginBackgroundMode => {
  const currentHour = date.getHours();
  return currentHour >= 8 && currentHour < 20 ? 'day' : 'night';
};

export const resolveInitialLoginBackgroundMode = (date = new Date()): LoginBackgroundMode => {
  const currentPeriod = resolveTimeBasedLoginBackgroundMode(date);
  return readStoredLoginBackgroundMode(currentPeriod) ?? currentPeriod;
};

export const resolveLoginBackgroundImage = (mode: LoginBackgroundMode): string =>
  mode === 'day' ? '/images/login/hhr-login-day.png' : '/images/login/hhr-login-night.png';
