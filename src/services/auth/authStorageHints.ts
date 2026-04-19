const FIREBASE_AUTH_STORAGE_PREFIX = 'firebase:authUser:';
const AUTHENTICATED_SESSION_HINT_KEY = 'hhr_logged_this_session';

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
