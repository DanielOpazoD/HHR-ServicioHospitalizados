const FIREBASE_AUTH_STORAGE_PREFIX = 'firebase:authUser:';
const AUTHENTICATED_SESSION_HINT_KEY = 'hhr_logged_this_session';
const GOOGLE_LOGIN_ATTEMPT_HINT_KEY = 'hhr_google_login_attempt_pending';
const GOOGLE_LOGIN_ATTEMPT_HINT_TTL_MS = 120_000;

const hasWindowStorage = (storage: Storage | undefined): storage is Storage =>
  typeof window !== 'undefined' && typeof storage !== 'undefined';

const storageContainsPrefix = (storage: Storage, prefix: string): boolean => {
  try {
    for (let index = 0; index < storage.length; index += 1) {
      const key = storage.key(index);
      if (key?.startsWith(prefix)) {
        return true;
      }
    }
  } catch {
    return false;
  }

  return false;
};

export const hasPersistedFirebaseAuthHint = (): boolean => {
  if (
    !hasWindowStorage(typeof localStorage === 'undefined' ? undefined : localStorage) &&
    !hasWindowStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)
  ) {
    return false;
  }

  return (
    (hasWindowStorage(typeof localStorage === 'undefined' ? undefined : localStorage) &&
      storageContainsPrefix(localStorage, FIREBASE_AUTH_STORAGE_PREFIX)) ||
    (hasWindowStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage) &&
      storageContainsPrefix(sessionStorage, FIREBASE_AUTH_STORAGE_PREFIX))
  );
};

export const hasRecentAuthenticatedSessionHint = (): boolean => {
  if (!hasWindowStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)) {
    return false;
  }

  try {
    return sessionStorage.getItem(AUTHENTICATED_SESSION_HINT_KEY) === 'true';
  } catch {
    return false;
  }
};

export const clearRecentAuthenticatedSessionHint = (): void => {
  if (!hasWindowStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)) {
    return;
  }

  try {
    sessionStorage.removeItem(AUTHENTICATED_SESSION_HINT_KEY);
  } catch {
    // Ignore storage errors
  }
};

export const markGoogleLoginAttemptHint = (): void => {
  if (!hasWindowStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)) {
    return;
  }

  try {
    sessionStorage.setItem(GOOGLE_LOGIN_ATTEMPT_HINT_KEY, String(Date.now()));
  } catch {
    // Ignore storage errors
  }
};

export const hasRecentGoogleLoginAttemptHint = (): boolean => {
  if (!hasWindowStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)) {
    return false;
  }

  try {
    const rawValue = sessionStorage.getItem(GOOGLE_LOGIN_ATTEMPT_HINT_KEY);
    if (!rawValue) {
      return false;
    }

    const startedAt = Number(rawValue);
    return Number.isFinite(startedAt) && Date.now() - startedAt <= GOOGLE_LOGIN_ATTEMPT_HINT_TTL_MS;
  } catch {
    return false;
  }
};

export const clearGoogleLoginAttemptHint = (): void => {
  if (!hasWindowStorage(typeof sessionStorage === 'undefined' ? undefined : sessionStorage)) {
    return;
  }

  try {
    sessionStorage.removeItem(GOOGLE_LOGIN_ATTEMPT_HINT_KEY);
  } catch {
    // Ignore storage errors
  }
};
