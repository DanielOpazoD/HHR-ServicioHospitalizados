import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClinicalAISummaryHandler } from '../../../netlify/functions/clinical-ai-summary';
import type { ClinicalAISummaryContext } from '@/application/ai/clinicalSummaryContextUseCase';

const baseContext: ClinicalAISummaryContext = {
  recordDate: '2026-03-25',
  bedId: 'R1',
  episodeKey: '11.111.111-1__2026-03-20',
  patient: {
    name: 'Paciente Demo',
    rut: '11.111.111-1',
    age: '54',
    admissionDate: '2026-03-20',
    specialty: 'Medicina',
    status: 'Estable',
    diagnosis: 'Neumonía',
    devices: [],
    clinicalEvents: [],
    medicalHandoffEntries: [],
  },
  nursingHandoff: {
    nursesDayShift: [],
    nursesNightShift: [],
    tensDayShift: [],
    tensNightShift: [],
    dayChecklist: {},
    nightChecklist: {},
  },
  medicalHandoff: {
    bySpecialty: {},
  },
  clinicalDocuments: [],
};

describe('clinical-ai-summary netlify function', () => {
  const getFirebaseServerMock = vi.fn();
  const authorizeRoleRequestMock = vi.fn();
  const extractBearerTokenMock = vi.fn();
  const loadClinicalAIContextFromFirestoreMock = vi.fn();
  const resolveClinicalAIProviderConfigMock = vi.fn();
  const generateClinicalAITextMock = vi.fn();

  const handler = createClinicalAISummaryHandler({
    getFirebaseServer: getFirebaseServerMock as typeof getFirebaseServerMock,
    authorizeRoleRequest: authorizeRoleRequestMock as typeof authorizeRoleRequestMock,
    extractBearerToken: extractBearerTokenMock as typeof extractBearerTokenMock,
    loadClinicalAIContextFromFirestore:
      loadClinicalAIContextFromFirestoreMock as typeof loadClinicalAIContextFromFirestoreMock,
    resolveClinicalAIProviderConfig:
      resolveClinicalAIProviderConfigMock as typeof resolveClinicalAIProviderConfigMock,
    generateClinicalAIText: generateClinicalAITextMock as typeof generateClinicalAITextMock,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    getFirebaseServerMock.mockReturnValue({ db: { kind: 'firestore' } });
    extractBearerTokenMock.mockReturnValue('token-123');
    authorizeRoleRequestMock.mockResolvedValue({
      email: 'doctor@hospital.cl',
      role: 'doctor_urgency',
    });
    loadClinicalAIContextFromFirestoreMock.mockResolvedValue(baseContext);
    resolveClinicalAIProviderConfigMock.mockReturnValue({
      provider: 'openai',
      apiKey: 'openai-key',
      model: 'gpt-4o-mini',
    });
    generateClinicalAITextMock.mockResolvedValue('Resumen clínico generado.');
  });

  it('returns available false when no provider is configured', async () => {
    resolveClinicalAIProviderConfigMock.mockReturnValue(null);

    const response = await handler({
      httpMethod: 'POST',
      headers: {},
      body: JSON.stringify({ recordDate: '2026-03-25', bedId: 'R1' }),
    });

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      available: false,
      message: 'AI not configured',
    });
  });

  it('returns 400 when required context selectors are missing', async () => {
    const response = await handler({
      httpMethod: 'POST',
      headers: {
        authorization: 'Bearer token-123',
      },
      body: JSON.stringify({ recordDate: '2026-03-25' }),
    });

    expect(response.statusCode).toBe(400);
    expect(response.body).toContain('recordDate y bedId son requeridos');
  });

  it('returns a clinical summary for authorized callers', async () => {
    const response = await handler({
      httpMethod: 'POST',
      headers: {
        authorization: 'Bearer token-123',
      },
      body: JSON.stringify({
        recordDate: '2026-03-25',
        bedId: 'R1',
        instruction: 'Resumir para relevo clínico.',
      }),
    });

    expect(response.statusCode).toBe(200);
    expect(loadClinicalAIContextFromFirestoreMock).toHaveBeenCalledWith({
      db: { kind: 'firestore' },
      recordDate: '2026-03-25',
      bedId: 'R1',
    });
    expect(generateClinicalAITextMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(response.body)).toEqual({
      available: true,
      provider: 'openai',
      model: 'gpt-4o-mini',
      summary: 'Resumen clínico generado.',
    });
  });
});
