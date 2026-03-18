const PROXY_ROUTE_PREFIX = '/.netlify/functions/whatsapp-proxy';
const CORS_ALLOWED_HEADERS = 'Content-Type, Authorization';
const CORS_ALLOWED_METHODS = 'GET,POST,OPTIONS';

const resolveBotBaseUrl = (): string =>
  (process.env.WHATSAPP_BOT_URL || process.env.WHATSAPP_BOT_SERVER || '').replace(/\/$/, '');

const normalizeUrlOrigin = (value: string | undefined): string | null => {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
};

const resolveAllowedOrigins = (): string[] =>
  [
    process.env.URL,
    process.env.DEPLOY_PRIME_URL,
    process.env.DEPLOY_URL,
    process.env.SITE_URL,
    process.env.APP_URL,
  ]
    .map(normalizeUrlOrigin)
    .filter((origin): origin is string => Boolean(origin));

const buildCorsHeaders = (requestOrigin?: string): Record<string, string> => {
  const headers: Record<string, string> = {
    'Access-Control-Allow-Headers': CORS_ALLOWED_HEADERS,
    'Access-Control-Allow-Methods': CORS_ALLOWED_METHODS,
    Vary: 'Origin',
  };

  if (requestOrigin && resolveAllowedOrigins().includes(requestOrigin)) {
    headers['Access-Control-Allow-Origin'] = requestOrigin;
  }

  return headers;
};

const isOriginAllowed = (requestOrigin?: string): boolean =>
  !requestOrigin || resolveAllowedOrigins().includes(requestOrigin);

const getPathSuffix = (path: string | undefined) => {
  if (!path) return '/';
  const suffix = path.startsWith(PROXY_ROUTE_PREFIX) ? path.slice(PROXY_ROUTE_PREFIX.length) : path;
  return suffix.startsWith('/') ? suffix : `/${suffix}`;
};

interface NetlifyEvent {
  httpMethod: string;
  headers: Record<string, string | undefined>;
  body: string | null;
  path: string;
  rawQuery?: string;
  isBase64Encoded?: boolean;
  [key: string]: unknown;
}

const getRequestOrigin = (event: NetlifyEvent): string | undefined =>
  event.headers?.origin || event.headers?.Origin;

export const handler = async (event: NetlifyEvent) => {
  const requestOrigin = getRequestOrigin(event);
  const corsHeaders = buildCorsHeaders(requestOrigin);

  if (!isOriginAllowed(requestOrigin)) {
    return {
      statusCode: 403,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Origin not allowed' }),
    };
  }

  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: corsHeaders,
      body: '',
    };
  }

  const botBaseUrl = resolveBotBaseUrl();
  if (!botBaseUrl) {
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Missing WHATSAPP_BOT_URL environment variable' }),
    };
  }

  const targetPath = getPathSuffix(event.path);
  const query = event.rawQuery ? `?${event.rawQuery}` : '';
  const targetUrl = `${botBaseUrl}${targetPath}${query}`;

  try {
    const headers: Record<string, string> = {};
    const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'];
    if (contentType) {
      headers['Content-Type'] = contentType;
    }

    const authorization = event.headers?.authorization || event.headers?.Authorization;
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
    return {
      statusCode: 502,
      headers: corsHeaders,
      body: JSON.stringify({
        error: 'Failed to reach WhatsApp bot server',
        details: error instanceof Error ? error.message : String(error),
      }),
    };
  }
};
