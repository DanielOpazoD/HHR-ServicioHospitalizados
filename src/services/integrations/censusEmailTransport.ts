import { resolveCurrentUserAuthHeaders } from '@/services/auth/authRequestHeaders';

export interface CensusEmailTransportRequest {
  endpoint: string;
  body: string;
  userEmail?: string | null;
  userRole?: string | null;
  signal: AbortSignal;
}

export const sendCensusEmailTransportRequest = async (
  request: CensusEmailTransportRequest,
  fetchImpl: typeof fetch
): Promise<Response> => {
  const authHeaders = await resolveCurrentUserAuthHeaders();

  return fetchImpl(request.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
    },
    body: request.body,
    signal: request.signal,
  });
};
