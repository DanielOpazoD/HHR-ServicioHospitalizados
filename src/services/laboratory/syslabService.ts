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
 * @example
 * ```ts
 * const result = await searchSyslabExams('12345678-9');
 * if (result.success) {
 *   console.log(result.data); // SyslabExamItem[]
 * }
 * ```
 */

import { createScopedLogger } from '@/services/utils/loggerScope';
import type { SyslabSearchResponse } from '@/types/domain/laboratory';

const syslabLogger = createScopedLogger('syslabService');

/** Return the Syslab Express server base URL from env or default. */
export const getSyslabBaseUrl = (): string =>
  import.meta.env.VITE_SYSLAB_API_URL || 'http://localhost:3000';

/**
 * Strip a Chilean RUT to its numeric body only (no dots, dash, or check digit).
 * Syslab requires this format for patient lookup.
 *
 * @example
 * ```ts
 * cleanRutForSyslab('12.345.678-9') // '12345678'
 * cleanRutForSyslab('12345678-9')   // '12345678'
 * cleanRutForSyslab('12345678')     // '12345678'
 * ```
 */
export const cleanRutForSyslab = (rut: string): string =>
  rut.replace(/\./g, '').replace(/-.*$/, '').trim();

/**
 * Search for patient lab exams in Syslab by RUT.
 *
 * Calls `GET /api/exams?rut=<body>` on the Express proxy.
 * The RUT is automatically cleaned to the numeric body only.
 *
 * @throws {Error} On network failure or non-OK HTTP status.
 */
export const searchSyslabExams = async (rut: string): Promise<SyslabSearchResponse> => {
  const cleanRut = cleanRutForSyslab(rut);
  const url = `${getSyslabBaseUrl()}/api/exams?rut=${encodeURIComponent(cleanRut)}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error de conexión' }));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    syslabLogger.error('Syslab exam search failed', error);
    throw error;
  }
};

/**
 * Build a URL that proxies an exam PDF through the Express server.
 * The returned URL can be used as an `<iframe>` src to display the PDF inline.
 *
 * @param examLink - The original Syslab link from {@link SyslabExamItem.link}.
 */
export const buildSyslabPdfUrl = (examLink: string): string =>
  `${getSyslabBaseUrl()}/api/exams/pdf?link=${encodeURIComponent(examLink)}`;
