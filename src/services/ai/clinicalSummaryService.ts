import { resolveCurrentUserAuthHeaders } from '@/services/auth/authRequestHeaders';

export interface ClinicalSummaryRequest {
  recordDate: string;
  bedId: string;
  instruction?: string;
}

export interface ClinicalSummaryResponse {
  available: boolean;
  provider?: string;
  model?: string;
  summary: string;
  message?: string;
}

const resolveEndpoint = (): string =>
  import.meta.env.VITE_CLINICAL_AI_SUMMARY_ENDPOINT || '/.netlify/functions/clinical-ai-summary';

export const generateClinicalSummary = async (
  request: ClinicalSummaryRequest
): Promise<ClinicalSummaryResponse> => {
  const authHeaders = await resolveCurrentUserAuthHeaders();
  const response = await fetch(resolveEndpoint(), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: JSON.stringify(request),
  });

  const payload = (await response.json()) as ClinicalSummaryResponse | { error?: string };
  if (!response.ok) {
    throw new Error(
      'error' in payload && typeof payload.error === 'string'
        ? payload.error
        : 'No se pudo generar el resumen clínico.'
    );
  }

  return payload as ClinicalSummaryResponse;
};
