/**
 * syslab-proxy Netlify Function
 *
 * Server-side proxy that forwards lab requests to the hospital's Express
 * proxy (API-laboratorioHHR) exposed via a public tunnel (e.g. Cloudflare
 * Tunnel, ngrok). This avoids CSP and CORS issues in production.
 *
 * Environment variable required:
 *   SYSLAB_PROXY_URL — Public URL of the Express proxy
 *                       (e.g. "https://lab-hhr.example.com")
 *
 * Supported actions (via `action` query parameter):
 *   - search:  GET  /api/exams?rut=<rut>
 *   - details: POST /api/exams/details  (body: { links: string[] })
 *   - pdf:     GET  /api/exams/pdf?link=<url>  (returns raw PDF bytes)
 */

import {
  buildJsonResponse,
  buildTextResponse,
  buildTooManyRequestsResponse,
  getClientIp,
  getRequestOrigin,
  isRateLimited,
  parseJsonBody,
  type NetlifyEventLike,
} from './lib/http';

const TIMEOUT_MS = 60_000; // 60s — PDF parsing can be slow

const getProxyUrl = (): string | null => process.env.SYSLAB_PROXY_URL?.replace(/\/+$/, '') || null;

const proxyFetch = async (url: string, options: RequestInit = {}): Promise<Response> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const headers = {
      ...(options.headers as Record<string, string>),
      // Skip ngrok free-tier browser interstitial warning page
      'ngrok-skip-browser-warning': 'true',
      'User-Agent': 'HHR-Netlify-Function',
    };
    const response = await fetch(url, { ...options, headers, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeout);
  }
};

/* ── Search exams by RUT ─────────────────────────────────────────────── */

const handleSearch = async (proxyUrl: string, params: URLSearchParams, requestOrigin?: string) => {
  const rut = params.get('rut');
  if (!rut) {
    return buildJsonResponse(400, { error: 'RUT es requerido' }, { requestOrigin });
  }

  const url = `${proxyUrl}/api/exams?rut=${encodeURIComponent(rut)}`;
  const response = await proxyFetch(url);
  const data = await response.json();

  return buildJsonResponse(response.status === 200 ? 200 : 502, data, { requestOrigin });
};

/* ── Fetch exam details (PDF parsing) ────────────────────────────────── */

const handleDetails = async (
  proxyUrl: string,
  body: string | null | undefined,
  requestOrigin?: string
) => {
  const parsed = parseJsonBody<{ links: string[] }>(body);
  if (!parsed.ok) {
    return buildJsonResponse(400, { error: parsed.error }, { requestOrigin });
  }

  const { links } = parsed.value;
  if (!Array.isArray(links) || links.length === 0) {
    return buildJsonResponse(400, { error: 'Se requiere un array de links' }, { requestOrigin });
  }

  const url = `${proxyUrl}/api/exams/details`;
  const response = await proxyFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ links }),
  });
  const data = await response.json();

  return buildJsonResponse(response.status === 200 ? 200 : 502, data, { requestOrigin });
};

/* ── Proxy PDF for inline viewing ────────────────────────────────────── */

const handlePdf = async (proxyUrl: string, params: URLSearchParams, requestOrigin?: string) => {
  const link = params.get('link');
  if (!link) {
    return buildJsonResponse(400, { error: 'link es requerido' }, { requestOrigin });
  }

  const url = `${proxyUrl}/api/exams/pdf?link=${encodeURIComponent(link)}`;
  const response = await proxyFetch(url);

  if (!response.ok) {
    return buildTextResponse(502, 'Error al obtener el PDF del servidor de laboratorio', {
      requestOrigin,
    });
  }

  const buffer = await response.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Cache-Control': 'private, max-age=300',
    },
    body: base64,
    isBase64Encoded: true,
  };
};

/* ── Handler ─────────────────────────────────────────────────────────── */

export const handler = async (event: NetlifyEventLike) => {
  const requestOrigin = getRequestOrigin(event);

  if (event.httpMethod === 'OPTIONS') {
    return buildJsonResponse(200, {}, { requestOrigin });
  }

  // Rate limit only the actual request, not the CORS preflight.
  const clientIp = getClientIp(event);
  if (isRateLimited(clientIp, { maxPerWindow: 20, windowMs: 60_000 })) {
    return buildTooManyRequestsResponse(requestOrigin);
  }

  const proxyUrl = getProxyUrl();
  if (!proxyUrl) {
    return buildJsonResponse(
      503,
      {
        success: false,
        error:
          'El servicio de laboratorio no está configurado. ' +
          'Configure la variable SYSLAB_PROXY_URL en Netlify.',
      },
      { requestOrigin }
    );
  }

  const params = new URLSearchParams(event.rawQuery || '');
  const action = params.get('action');

  try {
    switch (action) {
      case 'search':
        return await handleSearch(proxyUrl, params, requestOrigin);
      case 'details':
        return await handleDetails(proxyUrl, event.body, requestOrigin);
      case 'pdf':
        return await handlePdf(proxyUrl, params, requestOrigin);
      default:
        return buildJsonResponse(
          400,
          { error: 'Acción no válida. Use: search, details, pdf' },
          { requestOrigin }
        );
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error de conexión con el laboratorio';
    const isTimeout = error instanceof Error && error.name === 'AbortError';
    return buildJsonResponse(
      isTimeout ? 504 : 502,
      {
        success: false,
        error: isTimeout ? 'Timeout: el servidor de laboratorio no respondió a tiempo' : message,
      },
      { requestOrigin }
    );
  }
};
