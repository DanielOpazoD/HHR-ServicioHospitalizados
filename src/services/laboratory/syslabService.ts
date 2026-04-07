/**
 * Syslab Laboratory Service
 * Fetches lab exam data from the Syslab Express server running on the hospital LAN.
 */

import { createScopedLogger } from '@/services/utils/loggerScope';
import type { SyslabSearchResponse, SyslabDetailsResponse } from '@/types/domain/laboratory';

const syslabLogger = createScopedLogger('syslabService');

const getSyslabBaseUrl = (): string =>
  import.meta.env.VITE_SYSLAB_API_URL || 'http://localhost:3000';

export const searchSyslabExams = async (rut: string): Promise<SyslabSearchResponse> => {
  // Syslab expects RUT body only: no dots, no dash, no check digit
  const cleanRut = rut.replace(/\./g, '').replace(/-.*$/, '').trim();
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

/** Build a URL that proxies the exam PDF through the Express server. */
export const buildSyslabPdfUrl = (examLink: string): string =>
  `${getSyslabBaseUrl()}/api/exams/pdf?link=${encodeURIComponent(examLink)}`;

export const fetchSyslabExamDetails = async (links: string[]): Promise<SyslabDetailsResponse> => {
  const url = `${getSyslabBaseUrl()}/api/exams/details`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ links }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Error de conexión' }));
      throw new Error(errorData.error || `Error ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    syslabLogger.error('Syslab exam details fetch failed', error);
    throw error;
  }
};
