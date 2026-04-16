import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createWhatsAppProxyHandler, handler } from '../../../netlify/functions/whatsapp-proxy';

describe('whatsapp-proxy', () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();
  const getFirebaseServerMock = vi.fn(() => ({ db: {} }));
  const authorizeRoleRequestMock = vi.fn().mockResolvedValue({
    uid: 'u1',
    email: 'nurse@hospital.test',
    role: 'nurse_hospital',
  });
  const extractBearerTokenMock = vi.fn().mockReturnValue('token');

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      WHATSAPP_BOT_URL: 'https://bot.example.com',
      URL: 'https://app.example.com',
      DEPLOY_PRIME_URL: '',
      DEPLOY_URL: '',
      SITE_URL: '',
      APP_URL: '',
    };
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('allows configured origins on preflight requests', async () => {
    const response = await handler({
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://app.example.com' },
      body: null,
      path: '/.netlify/functions/whatsapp-proxy/messages',
    });
    const headers = response.headers as Record<string, string>;

    expect(response.statusCode).toBe(200);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(headers.Vary).toBe('Origin');
  });

  it('rejects requests from untrusted origins', async () => {
    const response = await handler({
      httpMethod: 'POST',
      headers: { origin: 'https://evil.example.com' },
      body: '{"ok":true}',
      path: '/.netlify/functions/whatsapp-proxy/messages',
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain('Origin not allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requires a bearer token before forwarding requests', async () => {
    const securedHandler = createWhatsAppProxyHandler({
      getFirebaseServer: getFirebaseServerMock as never,
      authorizeRoleRequest: authorizeRoleRequestMock as never,
      extractBearerToken: vi.fn(() => {
        throw new Error('Missing Authorization bearer token.');
      }) as never,
      fetch: fetchMock,
    });

    const response = await securedHandler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://app.example.com',
        'content-type': 'application/json',
      },
      body: '{"message":"hola"}',
      path: '/.netlify/functions/whatsapp-proxy/messages',
    });

    expect(response.statusCode).toBe(401);
    expect(response.body).toContain('Missing Authorization bearer token.');
    expect(authorizeRoleRequestMock).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects callers without an allowed role', async () => {
    const securedHandler = createWhatsAppProxyHandler({
      getFirebaseServer: getFirebaseServerMock as never,
      authorizeRoleRequest: vi
        .fn()
        .mockRejectedValue(new Error('Access denied for role viewer.')) as never,
      extractBearerToken: extractBearerTokenMock as never,
      fetch: fetchMock,
    });

    const response = await securedHandler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://app.example.com',
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: '{"message":"hola"}',
      path: '/.netlify/functions/whatsapp-proxy/messages',
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain('Access denied for role viewer.');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('forwards requests to the bot and reflects the trusted origin', async () => {
    fetchMock.mockResolvedValue({
      status: 202,
      text: vi.fn().mockResolvedValue('{"sent":true}'),
      headers: new Headers({ 'content-type': 'application/json' }),
    });
    const securedHandler = createWhatsAppProxyHandler({
      getFirebaseServer: getFirebaseServerMock as never,
      authorizeRoleRequest: authorizeRoleRequestMock as never,
      extractBearerToken: extractBearerTokenMock as never,
      fetch: fetchMock,
    });

    const response = await securedHandler({
      httpMethod: 'POST',
      headers: {
        origin: 'https://app.example.com',
        'content-type': 'application/json',
        authorization: 'Bearer token',
      },
      body: '{"message":"hola"}',
      path: '/.netlify/functions/whatsapp-proxy/messages',
      rawQuery: 'channel=handoff',
    });
    const headers = response.headers as Record<string, string>;

    expect(fetchMock).toHaveBeenCalledWith('https://bot.example.com/messages?channel=handoff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      },
      body: '{"message":"hola"}',
    });
    expect(extractBearerTokenMock).toHaveBeenCalledWith('Bearer token');
    expect(authorizeRoleRequestMock).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBe(202);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(headers['Content-Type']).toBe('application/json');
  });
});
