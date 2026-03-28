import type { FirebaseOptions } from 'firebase/app';
import { safeJsonParse } from '@/utils/jsonUtils';
import { readDevFirebaseApiKey } from '@/services/firebase-runtime/firebaseEnvironmentPolicy';
import { firebaseConfigLoaderLogger } from '@/services/firebase-runtime/firebaseRuntimeLoggers';

const CACHED_CONFIG_KEY = 'hhr_firebase_config';

const saveCachedConfig = (config: FirebaseOptions) => {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(CACHED_CONFIG_KEY, JSON.stringify(config));
  } catch (error) {
    firebaseConfigLoaderLogger.warn('[FirebaseConfig] Failed to cache Firebase config:', error);
  }
};

const getCachedConfig = (): FirebaseOptions | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(CACHED_CONFIG_KEY);
    if (!raw) return null;
    const parsed = safeJsonParse<FirebaseOptions | null>(raw, null);
    if (!parsed) return null;
    return parsed.apiKey ? parsed : null;
  } catch (error) {
    firebaseConfigLoaderLogger.warn(
      '[FirebaseConfig] Failed to read cached Firebase config:',
      error
    );
    return null;
  }
};

const fetchRuntimeConfig = async (): Promise<FirebaseOptions> => {
  const configUrl = `/.netlify/functions/firebase-config?t=${Date.now()}&mode=recovery`;
  const response = await fetch(configUrl, {
    headers: { 'Cache-Control': 'no-cache' },
  });

  if (!response.ok) {
    throw new Error(`Runtime config request failed (${response.status})`);
  }

  const config = await response.json();
  return config satisfies FirebaseOptions;
};

const buildDevConfig = (): FirebaseOptions => {
  const encodedKey = import.meta.env.VITE_FIREBASE_API_KEY_B64 || '';
  const plainKey = import.meta.env.VITE_FIREBASE_API_KEY || '';

  firebaseConfigLoaderLogger.info('Checking environment variables', {
    hasApiKey: !!plainKey,
    hasB64Key: !!encodedKey,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    mode: import.meta.env.MODE,
  });

  return {
    apiKey: readDevFirebaseApiKey(),
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  } satisfies FirebaseOptions;
};

export const loadFirebaseConfig = async (): Promise<FirebaseOptions> => {
  if (import.meta.env.DEV) {
    return buildDevConfig();
  }

  const cached = getCachedConfig();

  try {
    const config = await fetchRuntimeConfig();
    saveCachedConfig(config);
    return config;
  } catch (error) {
    if (cached?.apiKey) {
      firebaseConfigLoaderLogger.warn(
        '[FirebaseConfig] Using cached Firebase config due to network error',
        error
      );
      return cached;
    }

    throw error;
  }
};
