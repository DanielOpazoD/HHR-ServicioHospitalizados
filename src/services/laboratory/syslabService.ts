/**
 * @module syslabService
 * @description Client-side service for the Syslab laboratory API.
 *
 * Communicates with the Express proxy server (API-laboratorioHHR) that runs
 * on the hospital LAN and scrapes the Syslab web portal via Playwright.
 *
 * The base URL is configured via the `VITE_SYSLAB_API_URL` env variable
 * (defaults to `http://localhost:3000`).
 *
 * Features:
 * - Automatic RUT cleaning for Syslab format
 * - Request timeout (30s default, configurable)
 * - Single retry on network failures
 *
 * @example
 * ```ts
 * const result = await searchSyslabExams('12345678-9');
 * if (result.success) {
 *   console.log(result.data); // SyslabExamItem[]
 * }
 * ```
 */

import { createScopedLogger } from '@/services/utils/loggerScope';
import type { SyslabSearchResponse, SyslabDetailsResponse } from '@/types/domain/laboratory';

const syslabLogger = createScopedLogger('syslabService');

/** Default request timeout in milliseconds (30 seconds — Syslab scraping is slow). */
const DEFAULT_TIMEOUT_MS = 30_000;

/** Maximum number of retry attempts for transient network failures. */
const MAX_RETRIES = 1;

/** Return the Syslab Express server base URL from env or default. */
export const getSyslabBaseUrl = (): string =>
  import.meta.env.VITE_SYSLAB_API_URL || 'http://localhost:3000';

/**
 * Strip a Chilean RUT to its numeric body only (no dots, dash, or check digit).
 * Syslab requires this format for patient lookup.
 *
 * @param rut - RUT in any format (e.g., "12.345.678-9", "12345678-9", "12345678").
 * @returns Numeric body only (e.g., "12345678").
 *
 * @example
 * ```ts
 * cleanRutForSyslab('12.345.678-9') // '12345678'
 * cleanRutForSyslab('12345678-K')   // '12345678'
 * cleanRutForSyslab('')             // ''
 * ```
 */
export const cleanRutForSyslab = (rut: string): string =>
  rut.replace(/\./g, '').replace(/-.*$/, '').trim();

/**
 * Fetch with timeout and single retry for transient network failures.
 * @param url - Request URL.
 * @param options - Standard fetch options.
 * @param timeoutMs - Timeout in milliseconds.
 * @returns Fetch Response.
 * @throws {Error} On timeout, network failure (after retry), or non-OK status.
 */
const fetchWithRetry = async (
  url: string,
  options: RequestInit = {},
  timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<Response> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      const response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Error de conexión' }));
        throw new Error(errorData.error || `Error ${response.status}`);
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on non-network errors (4xx, 5xx already parsed above)
      if (lastError.name !== 'AbortError' && !lastError.message.includes('Failed to fetch')) {
        throw lastError;
      }

      if (attempt < MAX_RETRIES) {
        syslabLogger.warn(`Retry ${attempt + 1}/${MAX_RETRIES} for ${url}`);
        await new Promise(r => setTimeout(r, 1000)); // 1s delay before retry
      }
    }
  }

  throw lastError || new Error('Request failed');
};

/**
 * Search for patient lab exams in Syslab by RUT.
 *
 * Calls `GET /api/exams?rut=<body>` on the Express proxy.
 * The RUT is automatically cleaned to the numeric body only.
 *
 * @param rut - Patient RUT in any format.
 * @returns Search response with exam list.
 * @throws {Error} On network failure, timeout, or non-OK HTTP status.
 */
export const searchSyslabExams = async (rut: string): Promise<SyslabSearchResponse> => {
  const cleanRut = cleanRutForSyslab(rut);
  const url = `${getSyslabBaseUrl()}/api/exams?rut=${encodeURIComponent(cleanRut)}`;

  try {
    const response = await fetchWithRetry(url);
    return await response.json();
  } catch (error) {
    syslabLogger.error('Syslab exam search failed', error);
    throw error;
  }
};

/**
 * Fetch structured lab results by parsing exam PDFs server-side.
 *
 * Calls `POST /api/exams/details` on the Express proxy with an array of
 * Syslab exam links. The server opens each link via Playwright, extracts
 * the PDF text, and parses it into structured findings.
 *
 * Uses a longer timeout (60s) since PDF parsing involves browser automation.
 *
 * @param links - Array of Syslab exam URLs (from {@link SyslabExamItem.link}).
 * @returns Details response with parsed findings per exam.
 * @throws {Error} On network failure, timeout, or non-OK HTTP status.
 */
export const fetchSyslabExamDetails = async (links: string[]): Promise<SyslabDetailsResponse> => {
  const url = `${getSyslabBaseUrl()}/api/exams/details`;

  try {
    const response = await fetchWithRetry(
      url,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ links }),
      },
      60_000 // 60s timeout for PDF parsing
    );
    return await response.json();
  } catch (error) {
    syslabLogger.error('Syslab exam details fetch failed', error);
    throw error;
  }
};

/**
 * Build a URL that proxies an exam PDF through the Express server.
 * The returned URL can be used as an `<iframe>` src to display the PDF inline.
 *
 * @param examLink - The original Syslab link from {@link SyslabExamItem.link}.
 * @returns Proxy URL string.
 */
export const buildSyslabPdfUrl = (examLink: string): string =>
  `${getSyslabBaseUrl()}/api/exams/pdf?link=${encodeURIComponent(examLink)}`;
