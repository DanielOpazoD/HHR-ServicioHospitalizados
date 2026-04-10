import {
  buildCorsHeaders,
  buildJsonResponse,
  buildTooManyRequestsResponse,
  getClientIp,
  getHeader,
  getRequestOrigin,
  isOriginAllowed,
  isRateLimited,
  type NetlifyEventLike,
} from './lib/http';

const PROXY_ROUTE_PREFIX = '/.netlify/functions/whatsapp-proxy';

const resolveBotBaseUrl = (): string =>
  (process.env.WHATSAPP_BOT_URL || process.env.WHATSAPP_BOT_SERVER || '').replace(/\/$/, '');

const getPathSuffix = (path: string | undefined) => {
  if (!path) return '/';
  const suffix = path.startsWith(PROXY_ROUTE_PREFIX) ? path.slice(PROXY_ROUTE_PREFIX.length) : path;
  return suffix.startsWith('/') ? suffix : `/${suffix}`;
};

export const handler = async (event: NetlifyEventLike) => {
  const requestOrigin = getRequestOrigin(event);
  const corsHeaders = buildCorsHeaders(requestOrigin, {
    allowedHeaders: 'Content-Type, Authorization',
    allowedMethods: 'GET,POST,OPTIONS',
  });

  if (!isOriginAllowed(requestOrigin)) {
    return buildJsonResponse(403, { error: 'Origin not allowed' }, { requestOrigin });
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  // Rate limit only the actual request, not the CORS preflight.
  const clientIp = getClientIp(event);
  if (isRateLimited(clientIp, { maxPerWindow: 15, windowMs: 60_000 })) {
    return buildTooManyRequestsResponse(requestOrigin);
  }

  const botBaseUrl = resolveBotBaseUrl();
  if (!botBaseUrl) {
    return buildJsonResponse(
      500,
      { error: 'Missing WHATSAPP_BOT_URL environment variable' },
      { requestOrigin }
    );
  }

  const targetPath = getPathSuffix(event.path);
  const query = event.rawQuery ? `?${event.rawQuery}` : '';
  const targetUrl = `${botBaseUrl}${targetPath}${query}`;

  try {
    const headers: Record<string, string> = {};
    const contentType = getHeader(event.headers, 'content-type');
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const authorization = getHeader(event.headers, 'authorization');
    if (authorization) {
      headers.Authorization = authorization;
    }

    const init: RequestInit = {
      method: event.httpMethod,
      headers,
    };

    if (event.body && event.httpMethod !== 'GET' && event.httpMethod !== 'HEAD') {
      init.body = event.isBase64Encoded ? Buffer.from(event.body, 'base64') : event.body;
    }

    const response = await fetch(targetUrl, init);
    const text = await response.text();
    const responseContentType = response.headers.get('content-type') || 'application/json';

    return {
      statusCode: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': responseContentType,
      },
      body: text,
    };
  } catch (error: unknown) {
    console.error('WhatsApp proxy error', error);
    return buildJsonResponse(
      502,
      {
        error: 'Failed to reach WhatsApp bot server',
        details: error instanceof Error ? error.message : String(error),
      },
      { requestOrigin }
    );
  }
};
