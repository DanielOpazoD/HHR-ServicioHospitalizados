import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSign, generateKeyPairSync } from 'node:crypto';

const docMock = vi.fn();
const getDocMock = vi.fn();
const setDocMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  setDoc: (...args: unknown[]) => setDocMock(...args),
}));

import {
  authorizeRoleRequest,
  extractBearerToken,
  resolveRoleForEmail,
  verifyFirebaseIdToken,
} from '../../../netlify/functions/lib/firebase-auth';

const base64UrlEncode = (value: string | Buffer) =>
  Buffer.from(value).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');

describe('firebase-auth netlify helper', () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;
  const fixedNow = new Date('2026-03-26T12:00:00.000Z');
  const { privateKey, publicKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(fixedNow);
    process.env = {
      ...originalEnv,
      VITE_FIREBASE_PROJECT_ID: 'hhr-pruebas',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        'test-kid': publicKey.export({ type: 'pkcs1', format: 'pem' }).toString(),
      }),
      headers: new Headers({
        'cache-control': 'public, max-age=3600, must-revalidate, no-transform',
      }),
    }) as typeof fetch;

    docMock.mockReturnValue({ id: 'config-roles-ref' });
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        'doctor@hospital.cl': 'doctor_urgency',
      }),
    });
    setDocMock.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
    process.env = originalEnv;
    global.fetch = originalFetch;
  });

  const createToken = (payloadOverrides: Record<string, unknown> = {}) => {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const header = base64UrlEncode(
      JSON.stringify({
        alg: 'RS256',
        kid: 'test-kid',
        typ: 'JWT',
      })
    );
    const payload = base64UrlEncode(
      JSON.stringify({
        aud: 'hhr-pruebas',
        iss: 'https://securetoken.google.com/hhr-pruebas',
        sub: 'uid-123',
        email: 'doctor@hospital.cl',
        iat: nowSeconds - 60,
        exp: nowSeconds + 3600,
        ...payloadOverrides,
      })
    );
    const signingInput = `${header}.${payload}`;
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();
    const signature = signer.sign(privateKey);

    return `${signingInput}.${base64UrlEncode(signature)}`;
  };

  it('extracts bearer tokens from the authorization header', () => {
    expect(extractBearerToken('Bearer abc.123')).toBe('abc.123');
    expect(() => extractBearerToken(undefined)).toThrow('Missing Authorization bearer token');
  });

  it('verifies Firebase ID tokens against project, issuer and signature', async () => {
    const payload = await verifyFirebaseIdToken(createToken());

    expect(payload.sub).toBe('uid-123');
    expect(payload.email).toBe('doctor@hospital.cl');
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('rejects tokens signed for another Firebase project', async () => {
    await expect(
      verifyFirebaseIdToken(
        createToken({
          aud: 'other-project',
          iss: 'https://securetoken.google.com/other-project',
        })
      )
    ).rejects.toThrow('Invalid Firebase token audience');
  });

  it('authorizes allowed roles resolved from config/roles', async () => {
    const result = await authorizeRoleRequest(
      { kind: 'firestore' } as never,
      `Bearer ${createToken()}`,
      new Set(['doctor_urgency'])
    );

    expect(docMock).toHaveBeenCalledWith({ kind: 'firestore' }, 'config', 'roles');
    expect(result).toEqual(
      expect.objectContaining({
        email: 'doctor@hospital.cl',
        role: 'doctor_urgency',
      })
    );
  });

  it('self-heals legacy role aliases before authorizing Netlify requests', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({
        'doctor@hospital.cl': 'viewer_census',
      }),
    });

    await expect(
      resolveRoleForEmail({ kind: 'firestore' } as never, 'doctor@hospital.cl')
    ).resolves.toBe('viewer');
    expect(setDocMock).toHaveBeenCalledWith(
      { id: 'config-roles-ref' },
      { 'doctor@hospital.cl': 'viewer' }
    );
  });

  it('rejects authenticated users with roles outside the allowed set', async () => {
    await expect(
      authorizeRoleRequest(
        { kind: 'firestore' } as never,
        `Bearer ${createToken()}`,
        new Set(['admin'])
      )
    ).rejects.toThrow("Access denied for role 'doctor_urgency'");
  });
});
