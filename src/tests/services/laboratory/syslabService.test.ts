/**
 * @fileoverview Unit tests for the Syslab laboratory service.
 * Tests RUT cleaning, URL building, and API call behavior.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.unmock('@/services/laboratory/syslabService');

// Mock the scoped logger to avoid console noise
vi.mock('@/services/utils/loggerScope', () => ({
  createScopedLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  cleanRutForSyslab,
  getSyslabBaseUrl,
  searchSyslabExams,
  fetchSyslabExamDetails,
  buildSyslabPdfUrl,
} from '@/services/laboratory/syslabService';

/* ------------------------------------------------------------------ */
/*  cleanRutForSyslab                                                  */
/* ------------------------------------------------------------------ */

describe('cleanRutForSyslab', () => {
  it('strips dots from formatted RUT', () => {
    expect(cleanRutForSyslab('12.345.678-9')).toBe('12345678');
  });

  it('strips dash and check digit', () => {
    expect(cleanRutForSyslab('12345678-9')).toBe('12345678');
  });

  it('handles RUT with K check digit', () => {
    expect(cleanRutForSyslab('5.600.574-K')).toBe('5600574');
  });

  it('returns numeric body when already clean', () => {
    expect(cleanRutForSyslab('12345678')).toBe('12345678');
  });

  it('trims whitespace', () => {
    expect(cleanRutForSyslab('  12345678-9  ')).toBe('12345678');
  });

  it('handles dots and dash together', () => {
    expect(cleanRutForSyslab('5.600.574-9')).toBe('5600574');
  });
});

/* ------------------------------------------------------------------ */
/*  getSyslabBaseUrl                                                   */
/* ------------------------------------------------------------------ */

describe('getSyslabBaseUrl', () => {
  it('returns default URL when env var is not set', () => {
    const url = getSyslabBaseUrl();
    // Either the env var value or the default
    expect(url).toMatch(/^http/);
  });
});

/* ------------------------------------------------------------------ */
/*  buildSyslabPdfUrl                                                  */
/* ------------------------------------------------------------------ */

describe('buildSyslabPdfUrl', () => {
  it('builds a proxy URL with encoded link parameter', () => {
    const link = 'http://10.4.69.90/syslab/detalleexamenes.php?id=123&user=abc';
    const result = buildSyslabPdfUrl(link);

    expect(result).toContain('/api/exams/pdf?link=');
    expect(result).toContain(encodeURIComponent(link));
  });

  it('URL-encodes special characters in the link', () => {
    const link = 'http://10.4.69.90/syslab/test?a=1&b=2';
    const result = buildSyslabPdfUrl(link);

    expect(result).not.toContain('&b=');
    expect(result).toContain(encodeURIComponent('&b=2'));
  });
});

/* ------------------------------------------------------------------ */
/*  searchSyslabExams                                                  */
/* ------------------------------------------------------------------ */

describe('searchSyslabExams', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('calls fetch with cleaned RUT in query parameter', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    await searchSyslabExams('5.600.574-9');

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const calledUrl = mockFetch.mock.calls[0][0] as string;
    expect(calledUrl).toContain('rut=5600574');
    expect(calledUrl).not.toContain('.');
    expect(calledUrl).not.toContain('-');
  });

  it('returns parsed JSON on success', async () => {
    const mockData = {
      success: true,
      data: [
        {
          id: '123',
          link: null,
          date: '01/01/2026',
          time: '10:00',
          patientName: 'Test',
          origin: 'LAB',
          exams: ['HEMOGRAMA'],
        },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await searchSyslabExams('12345678-9');

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('123');
  });

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Server error' }),
    });

    await expect(searchSyslabExams('12345678')).rejects.toThrow('Server error');
  });

  it('throws on network failure', async () => {
    mockFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(searchSyslabExams('12345678')).rejects.toThrow('Failed to fetch');
  });

  it('handles JSON parse failure on error response gracefully', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('not json')),
    });

    await expect(searchSyslabExams('12345678')).rejects.toThrow('Error de conexión');
  });
});

/* ------------------------------------------------------------------ */
/*  fetchSyslabExamDetails                                             */
/* ------------------------------------------------------------------ */

describe('fetchSyslabExamDetails', () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = mockFetch;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends POST with links array', async () => {
    const links = ['http://example.com/exam1', 'http://example.com/exam2'];
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ success: true, data: [] }),
    });

    await fetchSyslabExamDetails(links);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain('/api/exams/details');
    expect(options.method).toBe('POST');
    expect(JSON.parse(options.body)).toEqual({ links });
  });

  it('returns parsed findings on success', async () => {
    const mockData = {
      success: true,
      data: [
        {
          url: 'http://example.com/exam1',
          findings: [
            { section: 'HG', analysis: 'HB', result: '14', unit: 'g/dL', refValue: '12-16' },
          ],
        },
      ],
    };
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockData),
    });

    const result = await fetchSyslabExamDetails(['http://example.com/exam1']);
    expect(result.success).toBe(true);
    expect(result.data[0].findings).toHaveLength(1);
  });

  it('throws on non-OK HTTP response', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      json: () => Promise.resolve({ error: 'Internal error' }),
    });

    await expect(fetchSyslabExamDetails(['link'])).rejects.toThrow('Internal error');
  });
});
