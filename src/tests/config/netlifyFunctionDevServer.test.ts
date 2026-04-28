import { Readable } from 'node:stream';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_NETLIFY_FUNCTION_DEV_ENTRIES,
  handleNetlifyFunctionDevRequest,
} from '../../../scripts/config/netlifyFunctionDevServer';

const createReadableRequest = ({
  body = '',
  headers = {},
  method = 'POST',
  url,
}: {
  body?: string;
  headers?: Record<string, string>;
  method?: string;
  url: string;
}) => {
  const request = Readable.from(body ? [body] : []);
  return Object.assign(request, {
    headers,
    method,
    url,
  });
};

const createResponse = () => {
  const headers = new Map<string, string | number | readonly string[]>();
  return {
    body: '',
    ended: false,
    headers,
    statusCode: 200,
    setHeader(name: string, value: string | number | readonly string[]) {
      headers.set(name, value);
    },
    end(body?: string | Buffer) {
      this.body = Buffer.isBuffer(body) ? body.toString('utf8') : body || '';
      this.ended = true;
    },
  };
};

describe('netlifyFunctionDevServer', () => {
  it('serves the clinical document import function from Vite dev server', async () => {
    const requestBody = JSON.stringify({ sourceText: 'Informe de traslado con indicaciones.' });
    const request = createReadableRequest({
      body: requestBody,
      headers: {
        authorization: 'Bearer test-token',
        'content-type': 'application/json',
      },
      url: '/.netlify/functions/clinical-document-ai-import?trace=1',
    });
    const response = createResponse();
    const next = vi.fn();
    const handler = vi.fn(async event => ({
      statusCode: 200,
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({
        method: event.httpMethod,
        body: event.body,
        path: event.path,
        query: event.rawQuery,
      }),
    }));
    const loadModule = vi.fn(async () => ({ handler }));
    const server = {
      ssrFixStacktrace: vi.fn(),
    };

    await handleNetlifyFunctionDevRequest({
      entries: DEFAULT_NETLIFY_FUNCTION_DEV_ENTRIES,
      loadModule,
      next,
      req: request as unknown as IncomingMessage,
      res: response as unknown as ServerResponse,
      server,
    });

    expect(next).not.toHaveBeenCalled();
    expect(loadModule).toHaveBeenCalledWith('/netlify/functions/clinical-document-ai-import.ts');
    expect(handler).toHaveBeenCalledWith(
      expect.objectContaining({
        body: requestBody,
        headers: expect.objectContaining({
          authorization: 'Bearer test-token',
          'content-type': 'application/json',
        }),
        httpMethod: 'POST',
        path: '/.netlify/functions/clinical-document-ai-import',
        rawQuery: 'trace=1',
      })
    );
    expect(response.statusCode).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(JSON.parse(response.body)).toEqual({
      body: requestBody,
      method: 'POST',
      path: '/.netlify/functions/clinical-document-ai-import',
      query: 'trace=1',
    });
  });

  it('delegates non-function routes back to Vite', async () => {
    const request = createReadableRequest({ method: 'GET', url: '/census' });
    const response = createResponse();
    const next = vi.fn();
    const server = {
      ssrFixStacktrace: vi.fn(),
    };
    const loadModule = vi.fn();

    await handleNetlifyFunctionDevRequest({
      entries: DEFAULT_NETLIFY_FUNCTION_DEV_ENTRIES,
      loadModule,
      next,
      req: request as unknown as IncomingMessage,
      res: response as unknown as ServerResponse,
      server,
    });

    expect(next).toHaveBeenCalledTimes(1);
    expect(loadModule).not.toHaveBeenCalled();
    expect(response.ended).toBe(false);
  });
});
