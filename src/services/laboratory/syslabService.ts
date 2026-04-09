/**
 * @module syslabService
 * @description Client-side service for the Syslab laboratory API.
 *
 * In development, communicates directly with the Express proxy server
 * (API-laboratorioHHR) that runs on the hospital LAN and scrapes the
 * Syslab web portal via Playwright.
 *
 * In production (Netlify), calls the `syslab-proxy` Netlify Function
 * which forwards requests server-side to the Express proxy exposed via
 * a public tunnel.
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

/** True when running on a deployed Netlify site (not localhost dev). */
const isProduction = (): boolean => import.meta.env.PROD;

/** Return the Syslab Express server base URL from env or default. */
export const getSyslabBaseUrl = (): string =>
  import.meta.env.VITE_SYSLAB_API_URL || 'http://localhost:3000';

/**
 * Strip a Chilean RUT to its numeric body only (no dots, dash, or check digit).
 * Syslab requires this format for patient lookup.
 *
 * @param rut - RUT in any format (e.g., "12.345.678-9", "12345678-9", "12345678").
 * @returns Numeric body only (e.g., "12345678").
 */
export const cleanRutForSyslab = (rut: string): string =>
  rut.replace(/\./g, '').replace(/-.*$/, '').trim();

/**
 * Fetch with timeout and single retry for transient network failures.
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
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error('Request failed');
};

/**
 * Search for patient lab exams in Syslab by RUT.
 *
 * In production, calls the Netlify Function `syslab-proxy?action=search`.
 * In development, calls the Express proxy directly.
 */
export const searchSyslabExams = async (rut: string): Promise<SyslabSearchResponse> => {
  const cleanRut = cleanRutForSyslab(rut);

  const url = isProduction()
    ? `/.netlify/functions/syslab-proxy?action=search&rut=${encodeURIComponent(cleanRut)}`
    : `${getSyslabBaseUrl()}/api/exams?rut=${encodeURIComponent(cleanRut)}`;

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
 * In production, calls the Netlify Function `syslab-proxy?action=details`.
 * In development, calls the Express proxy directly.
 */
export const fetchSyslabExamDetails = async (links: string[]): Promise<SyslabDetailsResponse> => {
  const url = isProduction()
    ? '/.netlify/functions/syslab-proxy?action=details'
    : `${getSyslabBaseUrl()}/api/exams/details`;

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
 * Build a URL that proxies an exam PDF for inline viewing.
 *
 * In production, routes through the Netlify Function.
 * In development, uses the Express proxy directly.
 */
export const buildSyslabPdfUrl = (examLink: string): string =>
  isProduction()
    ? `/.netlify/functions/syslab-proxy?action=pdf&link=${encodeURIComponent(examLink)}`
    : `${getSyslabBaseUrl()}/api/exams/pdf?link=${encodeURIComponent(examLink)}`;
