import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/services/firebase-runtime/firebaseRuntimeLoggers', () => ({
  firebaseEnvironmentPolicyLogger: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import {
  parseEmulatorHost,
  decodeBase64,
  readDevFirebaseApiKey,
  shouldUseSingleTabFirestoreCache,
} from '@/services/firebase-runtime/firebaseEnvironmentPolicy';

describe('firebaseEnvironmentPolicy', () => {
  const savedEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Restore env vars between tests
    Object.keys(import.meta.env).forEach(key => {
      if (!(key in savedEnv)) {
        delete (import.meta.env as Record<string, unknown>)[key];
      }
    });
    Object.assign(import.meta.env, savedEnv);
  });

  // ── parseEmulatorHost ──────────────────────────────────────────────

  describe('parseEmulatorHost', () => {
    it('parses a valid "host:port" string', () => {
      const result = parseEmulatorHost('localhost:8080');
      expect(result).toEqual({ host: 'localhost', port: 8080 });
    });

    it('parses an IP-based host', () => {
      expect(parseEmulatorHost('127.0.0.1:9099')).toEqual({
        host: '127.0.0.1',
        port: 9099,
      });
    });

    it('returns null when there is no port segment', () => {
      expect(parseEmulatorHost('no-port')).toBeNull();
    });

    it('returns null when the port is not numeric', () => {
      expect(parseEmulatorHost('localhost:abc')).toBeNull();
    });

    it('returns null for an empty string', () => {
      expect(parseEmulatorHost('')).toBeNull();
    });

    it('returns null when host is empty but port is valid', () => {
      expect(parseEmulatorHost(':8080')).toBeNull();
    });
  });

  // ── decodeBase64 ───────────────────────────────────────────────────

  describe('decodeBase64', () => {
    it('decodes a standard base64 string', () => {
      // btoa('hello-world') === 'aGVsbG8td29ybGQ='
      expect(decodeBase64('aGVsbG8td29ybGQ=')).toBe('hello-world');
    });

    it('handles URL-safe base64 characters (- and _)', () => {
      // btoa('abc>def') === 'YWJjPmRlZg=='
      // URL-safe variant replaces + with - and / with _
      // 'YWJjPmRlZg==' has no + or /, so test with a value that does:
      // btoa('i\xb7\xbb') === 'ibe7uw==' — standard
      // For a simpler test: btoa('subjects?q') === 'c3ViamVjdHM/cQ=='
      // URL-safe: 'c3ViamVjdHM_cQ=='  (/ replaced with _)
      expect(decodeBase64('c3ViamVjdHM_cQ==')).toBe('subjects?q');
    });

    it('handles base64 with missing padding', () => {
      // 'abc' => btoa('abc') === 'YWJj' (no padding needed)
      // 'ab' => btoa('ab') === 'YWI=' — remove the padding to test
      expect(decodeBase64('YWI')).toBe('ab');
    });

    it('returns empty string for empty input', () => {
      expect(decodeBase64('')).toBe('');
    });

    it('returns empty string for falsy input', () => {
      expect(decodeBase64(undefined as unknown as string)).toBe('');
      expect(decodeBase64(null as unknown as string)).toBe('');
    });

    it('returns empty string for whitespace-only input', () => {
      expect(decodeBase64('   ')).toBe('');
    });
  });

  // ── readDevFirebaseApiKey ──────────────────────────────────────────

  describe('readDevFirebaseApiKey', () => {
    it('reads VITE_FIREBASE_API_KEY_B64 first and base64-decodes it', () => {
      // btoa('my-decoded-key') === 'bXktZGVjb2RlZC1rZXk='
      (import.meta.env as Record<string, string>).VITE_FIREBASE_API_KEY_B64 =
        'bXktZGVjb2RlZC1rZXk=';
      (import.meta.env as Record<string, string>).VITE_FIREBASE_API_KEY = 'plain-key';

      expect(readDevFirebaseApiKey()).toBe('my-decoded-key');
    });

    it('falls back to VITE_FIREBASE_API_KEY when B64 is not set', () => {
      (import.meta.env as Record<string, string>).VITE_FIREBASE_API_KEY_B64 = '';
      (import.meta.env as Record<string, string>).VITE_FIREBASE_API_KEY = 'plain-key';

      expect(readDevFirebaseApiKey()).toBe('plain-key');
    });

    it('returns empty string when neither env var is set', () => {
      (import.meta.env as Record<string, string>).VITE_FIREBASE_API_KEY_B64 = '';
      (import.meta.env as Record<string, string>).VITE_FIREBASE_API_KEY = '';

      expect(readDevFirebaseApiKey()).toBe('');
    });
  });

  // ── shouldUseSingleTabFirestoreCache ───────────────────────────────

  describe('shouldUseSingleTabFirestoreCache', () => {
    it('returns true when VITE_FIRESTORE_FORCE_SINGLE_TAB_CACHE is "true"', () => {
      (import.meta.env as Record<string, string>).VITE_FIRESTORE_FORCE_SINGLE_TAB_CACHE = 'true';
      expect(shouldUseSingleTabFirestoreCache()).toBe(true);
    });

    it('returns false when the env var is absent', () => {
      delete (import.meta.env as Record<string, string | undefined>)
        .VITE_FIRESTORE_FORCE_SINGLE_TAB_CACHE;
      expect(shouldUseSingleTabFirestoreCache()).toBe(false);
    });

    it('returns false when the env var is "false"', () => {
      (import.meta.env as Record<string, string>).VITE_FIRESTORE_FORCE_SINGLE_TAB_CACHE = 'false';
      expect(shouldUseSingleTabFirestoreCache()).toBe(false);
    });

    it('returns false when the env var is any non-"true" value', () => {
      (import.meta.env as Record<string, string>).VITE_FIRESTORE_FORCE_SINGLE_TAB_CACHE = '1';
      expect(shouldUseSingleTabFirestoreCache()).toBe(false);
    });
  });
});
