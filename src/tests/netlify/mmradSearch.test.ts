import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { handler } from '../../../netlify/functions/mmrad-search';

describe('mmrad-search', () => {
  const originalEnv = { ...process.env };
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      URL: 'https://app.example.com',
      DEPLOY_PRIME_URL: '',
      DEPLOY_URL: '',
      SITE_URL: '',
      APP_URL: '',
      MMRAD_USERNAME: 'testuser',
      MMRAD_PASSWORD: 'testpass',
    };
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.unstubAllGlobals();
  });

  it('returns 200 with CORS headers on OPTIONS', async () => {
    const response = await handler({
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://app.example.com' },
      body: null,
      rawQuery: '',
    });
    const headers = response.headers as Record<string, string>;

    expect(response.statusCode).toBe(200);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
  });

  it('returns 405 for non-GET methods', async () => {
    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: null,
      rawQuery: 'rut=12345678-9',
    });

    expect(response.statusCode).toBe(405);
    expect(response.body).toContain('Method not allowed');
  });

  it('returns 400 when rut is missing', async () => {
    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      body: null,
      rawQuery: '',
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('RUT');
  });

  it('handles login failure gracefully (no search form found)', async () => {
    // Step 1: GET home page — no login form in HTML
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('<html><body>No login form here</body></html>'),
    });

    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      body: null,
      rawQuery: 'rut=12345678-9',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.examenes).toEqual([]);
    expect(body._debug.error).toContain('Login failed');
  });

  it('handles successful search flow with exam results', async () => {
    const loginActionUrl =
      'https://ris.mmrad.cl/c/portal/login%2Flogin;jsessionid=abc123?p_l_id=123';
    const dashboardUrl = '/group/hhangaroa';
    const searchActionUrl = 'https://ris.mmrad.cl/examenportlet_WAR_portlet/search?p_l_id=456';

    // Step 1: GET home page — returns HTML with login form
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi
        .fn()
        .mockResolvedValue(
          `<html><form action="${loginActionUrl}" method="post"><input name="_58_login"/></form></html>`
        ),
    });

    // Step 2: POST login credentials — 302 redirect
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: '/c/portal/redirect' }),
      text: vi.fn().mockResolvedValue(''),
    });

    // Step 3: Follow first redirect — 302 to dashboard
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: dashboardUrl }),
      text: vi.fn().mockResolvedValue(''),
    });

    // Step 4: Follow second redirect — dashboard with search form
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(
        `<html><body>
          <form action="${searchActionUrl}" method="post">
            <input name="idpaciente" />
          </form>
        </body></html>`
      ),
    });

    // Step 5: POST search — exam results table
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(
        `<html><body><table>
          <tr>
            <td>0</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td>
            <td>01/01/2026</td><td>02/01/2026</td><td>8</td><td>9</td>
            <td>TC Torax</td><td>CT</td><td>12</td><td>Informado</td>
            <td>Acciones</td>
            <td><a href="/informePDF/123">PDF</a></td>
            <td><a href="javascript:window.open('/ingrad-ris-informehtml/UtilServlet?a=1&id=123');void(0);">HTML</a></td>
          </tr>
        </table></body></html>`
      ),
    });

    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(
        `<html><body>
          <h1>TOMOGRAFÍA SIMPLE DE TÓRAX</h1>
          <p><strong>HALLAZGOS:</strong></p>
          <p>Parénquima pulmonar sin consolidaciones.</p>
          <p><strong>IMPRESION:</strong></p>
          <p>Cardiomegalia.</p>
        </body></html>`
      ),
    });

    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      body: null,
      rawQuery: 'rut=12.345.678-9',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.rut).toBe('12345678-9');
    expect(body.examenes).toBeInstanceOf(Array);
    expect(body.examenes[0].informe_html_url).toContain('/ingrad-ris-informehtml/UtilServlet?a=1');
    expect(body.examenes[0].report.findings).toContain('Parénquima pulmonar');
    expect(body.examenes[0].report.impression).toContain('Cardiomegalia');
    expect(body._debug.login).toBeInstanceOf(Array);
    expect(body._debug.searchUrl).toBeDefined();
  });

  it('normalizes javascript report URLs returned inline by MMRAD', async () => {
    const loginActionUrl =
      'https://ris.mmrad.cl/c/portal/login%2Flogin;jsessionid=abc123?p_l_id=123';
    const dashboardUrl = '/group/hhangaroa';
    const searchActionUrl = 'https://ris.mmrad.cl/examenportlet_WAR_portlet/search?p_l_id=456';

    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi
        .fn()
        .mockResolvedValue(
          `<html><form action="${loginActionUrl}" method="post"><input name="_58_login"/></form></html>`
        ),
    });
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: '/c/portal/redirect' }),
      text: vi.fn().mockResolvedValue(''),
    });
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: dashboardUrl }),
      text: vi.fn().mockResolvedValue(''),
    });
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(
        `<html><body>
          <form action="${searchActionUrl}" method="post">
            <input name="idpaciente" />
          </form>
        </body></html>`
      ),
    });
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(
        `<html><body><table>
          <tr>
            <td>0</td><td>1</td><td>2</td><td>3</td><td>4</td><td>5</td>
            <td>01/01/2026</td><td>02/01/2026</td><td>8</td><td>9</td>
            <td>TC Torax</td><td>CT</td><td>12</td><td>Informado</td>
            <td>Acciones</td>
            <td>
              <a href="javascript:window.open('/ingrad-ris-informehtml/UtilServlet?a=1&u=269958&idexamen=1459869&idprestacion=202609');void(0);">HTML</a>
            </td>
          </tr>
        </table></body></html>`
      ),
    });
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue(
        `<html><body>
          <h1>TOMOGRAFÍA SIMPLE DE TÓRAX</h1>
          <p><strong>HALLAZGOS:</strong></p>
          <p>Hallazgos de prueba.</p>
          <p><strong>IMPRESION:</strong></p>
          <p>Impresión de prueba.</p>
        </body></html>`
      ),
    });

    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      body: null,
      rawQuery: 'rut=12.345.678-9',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.examenes[0].informe_html_url).toBe(
      'https://ris.mmrad.cl/ingrad-ris-informehtml/UtilServlet?a=1&u=269958&idexamen=1459869&idprestacion=202609'
    );
    expect(body.examenes[0].report.findings).toContain('Hallazgos de prueba');
    expect(body.examenes[0].report.impression).toContain('Impresión de prueba');
  });

  it('returns 500 when MMRAD credentials are not configured', async () => {
    delete process.env.MMRAD_USERNAME;
    delete process.env.MMRAD_PASSWORD;

    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      body: null,
      rawQuery: 'rut=12345678-9',
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain('MMRAD_USERNAME');
  });

  it('proxies PDFs inline for preview/print when action=pdf is requested', async () => {
    const loginActionUrl =
      'https://ris.mmrad.cl/c/portal/login%2Flogin;jsessionid=abc123?p_l_id=123';
    const dashboardUrl = '/group/hhangaroa';

    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi
        .fn()
        .mockResolvedValue(
          `<html><form action="${loginActionUrl}" method="post"><input name="_58_login"/></form></html>`
        ),
    });
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: '/c/portal/redirect' }),
      text: vi.fn().mockResolvedValue(''),
    });
    fetchMock.mockResolvedValueOnce({
      status: 302,
      headers: new Headers({ location: dashboardUrl }),
      text: vi.fn().mockResolvedValue(''),
    });
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers(),
      text: vi.fn().mockResolvedValue('<html><body>dashboard</body></html>'),
    });
    fetchMock.mockResolvedValueOnce({
      status: 200,
      headers: new Headers({ 'Content-Type': 'application/pdf' }),
      arrayBuffer: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3, 4]).buffer),
    });

    const response = await handler({
      httpMethod: 'GET',
      headers: { origin: 'https://app.example.com' },
      body: null,
      rawQuery:
        'action=pdf&link=' +
        encodeURIComponent('https://ris.mmrad.cl/informePDF?id=1459869&idprestacion=202609'),
    });

    const pdfResponse = response as typeof response & { isBase64Encoded?: boolean };

    expect(pdfResponse.statusCode).toBe(200);
    expect((pdfResponse.headers as Record<string, string>)['Content-Type']).toBe('application/pdf');
    expect((pdfResponse.headers as Record<string, string>)['Content-Disposition']).toContain(
      'inline'
    );
    expect(pdfResponse.isBase64Encoded).toBe(true);
    expect(pdfResponse.body).toBe(Buffer.from([1, 2, 3, 4]).toString('base64'));
  });

  it('returns 500 on fetch error', async () => {
    fetchMock.mockRejectedValue(new Error('Network error'));

    const response = await handler({
      httpMethod: 'GET',
      headers: {},
      body: null,
      rawQuery: 'rut=12345678-9',
    });

    expect(response.statusCode).toBe(500);
    expect(response.body).toContain('Network error');
  });
});
