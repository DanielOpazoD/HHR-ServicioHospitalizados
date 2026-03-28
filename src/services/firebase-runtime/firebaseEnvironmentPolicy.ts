import { firebaseEnvironmentPolicyLogger } from '@/services/firebase-runtime/firebaseRuntimeLoggers';

export const shouldUseSingleTabFirestoreCache = () => {
  if (typeof window === 'undefined') return false;

  const hostname = window.location.hostname;
  const isLocalhost =
    hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '0.0.0.0';

  return import.meta.env.DEV || isLocalhost;
};

export const parseEmulatorHost = (rawHost: string): { host: string; port: number } | null => {
  const [host, portRaw] = rawHost.split(':');
  const port = Number(portRaw);
  if (!host || !Number.isFinite(port)) return null;
  return { host, port };
};

export const decodeBase64 = (rawValue: string) => {
  const value = rawValue?.trim();
  if (!value) return '';

  const normalized = value
    .replace(/\s+/g, '')
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .padEnd(Math.ceil(value.length / 4) * 4, '=');

  try {
    if (typeof atob === 'function') {
      return atob(normalized);
    }

    return Buffer.from(normalized, 'base64').toString('utf-8');
  } catch (error) {
    firebaseEnvironmentPolicyLogger.warn(
      'Firebase API key could not be decoded from base64:',
      error
    );
    return '';
  }
};

export const readDevFirebaseApiKey = (): string => {
  const encodedKey = import.meta.env.VITE_FIREBASE_API_KEY_B64 || '';
  const plainKey = import.meta.env.VITE_FIREBASE_API_KEY || '';
  return encodedKey ? decodeBase64(encodedKey) : plainKey;
};
