import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.unmock('@/services/radiology/mmradService');

vi.mock('@/services/utils/loggerScope', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@/services/auth/authRequestHeaders', () => ({
  resolveCurrentUserAuthHeaders: vi.fn().mockResolvedValue({
    Authorization: 'Bearer token-123',
  }),
}));

import {
  buildMMRADPdfUrl,
  fetchMMRADPdfBlobUrl,
  searchMMRADExams,
} from '@/services/radiology/mmradService';

describe('mmradService', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:mmrad-pdf'),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('builds the proxied PDF URL with the encoded MMRAD link', () => {
    const pdfUrl = buildMMRADPdfUrl('https://ris.mmrad.cl/informePDF?id=1&prestacion=2');

    expect(pdfUrl).toContain('/.netlify/functions/mmrad-search?action=pdf&link=');
    expect(pdfUrl).toContain(encodeURIComponent('&prestacion=2'));
  });

  it('sends auth headers when searching MMRAD exams', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve({
          rut: '12345678-9',
          examenes: [],
        }),
    });

    const result = await searchMMRADExams({ rut: '12.345.678-9', dateFrom: '2026-01-01' });

    expect(result.examenes).toEqual([]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('rut=12345678-9'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
  });

  it('surfaces a clearer authorization error for local Netlify dev sessions', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      headers: new Headers({ 'content-type': 'application/json' }),
      json: () =>
        Promise.resolve({
          error:
            'Acceso denegado para MMRAD. Tu correo no tiene un rol autorizado en config/roles o la sesión local no corresponde al entorno actual.',
        }),
    });

    await expect(searchMMRADExams({ rut: '12.345.678-9' })).rejects.toThrow(
      /http:\/\/localhost:8888\/.*vuelve a iniciar sesión/i
    );
  });

  it('fetches the proxied PDF with auth headers and returns a blob URL', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      blob: () => Promise.resolve(new Blob(['pdf'], { type: 'application/pdf' })),
    });

    const result = await fetchMMRADPdfBlobUrl('https://ris.mmrad.cl/informePDF?id=1459869');

    expect(result).toBe('blob:mmrad-pdf');
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/.netlify/functions/mmrad-search?action=pdf&link='),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer token-123',
        }),
      })
    );
  });
});
