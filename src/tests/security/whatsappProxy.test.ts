import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from '../../../netlify/functions/whatsapp-proxy';

describe('whatsapp-proxy', () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

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

    expect(response.statusCode).toBe(200);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(response.headers.Vary).toBe('Origin');
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

  it('forwards requests to the bot and reflects the trusted origin', async () => {
    fetchMock.mockResolvedValue({
      status: 202,
      text: vi.fn().mockResolvedValue('{"sent":true}'),
      headers: new Headers({ 'content-type': 'application/json' }),
    });

    const response = await handler({
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

    expect(fetchMock).toHaveBeenCalledWith('https://bot.example.com/messages?channel=handoff', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer token',
      },
      body: '{"message":"hola"}',
    });
    expect(response.statusCode).toBe(202);
    expect(response.headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(response.headers['Content-Type']).toBe('application/json');
  });
});
