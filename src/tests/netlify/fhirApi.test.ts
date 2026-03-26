import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDocMock = vi.fn();
const getDocsMock = vi.fn();
const docMock = vi.fn();
const collectionMock = vi.fn();
const queryMock = vi.fn();
const whereMock = vi.fn();
const getFirebaseServerMock = vi.fn();
const mapMasterPatientToFhirMock = vi.fn();
const mapEncounterToFhirMock = vi.fn();
const authorizeFhirRequestMock = vi.fn();
const extractBearerTokenMock = vi.fn();

vi.mock('firebase/firestore', () => ({
  doc: (...args: unknown[]) => docMock(...args),
  getDoc: (...args: unknown[]) => getDocMock(...args),
  collection: (...args: unknown[]) => collectionMock(...args),
  query: (...args: unknown[]) => queryMock(...args),
  where: (...args: unknown[]) => whereMock(...args),
  getDocs: (...args: unknown[]) => getDocsMock(...args),
}));

vi.mock('../../../netlify/functions/lib/firebase-server', () => ({
  getFirebaseServer: () => getFirebaseServerMock(),
}));

vi.mock('../../../src/services/utils/fhirMappers', () => ({
  mapMasterPatientToFhir: (...args: unknown[]) => mapMasterPatientToFhirMock(...args),
  mapEncounterToFhir: (...args: unknown[]) => mapEncounterToFhirMock(...args),
}));

vi.mock('../../../netlify/functions/lib/firebase-auth', () => ({
  authorizeRoleRequest: (...args: unknown[]) => authorizeFhirRequestMock(...args),
  extractBearerToken: (...args: unknown[]) => extractBearerTokenMock(...args),
}));

import { handler } from '../../../netlify/functions/fhir-api';

describe('fhir-api netlify function', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = {
      ...originalEnv,
      URL: 'https://app.example.com',
      DEPLOY_PRIME_URL: '',
      DEPLOY_URL: '',
      SITE_URL: '',
      APP_URL: '',
    };

    getFirebaseServerMock.mockReturnValue({ db: { kind: 'firestore' } });
    docMock.mockReturnValue({ id: 'doc-ref' });
    collectionMock.mockReturnValue({ id: 'collection-ref' });
    whereMock.mockReturnValue({ id: 'where-ref' });
    queryMock.mockReturnValue({ id: 'query-ref' });
    mapMasterPatientToFhirMock.mockImplementation(data => ({
      resourceType: 'Patient',
      id: data.rut ?? 'patient-1',
    }));
    mapEncounterToFhirMock.mockImplementation(() => ({
      resourceType: 'Encounter',
      id: 'encounter-1',
    }));
    extractBearerTokenMock.mockReturnValue('token-123');
    authorizeFhirRequestMock.mockResolvedValue({
      email: 'clinician@hospital.cl',
      role: 'doctor_urgency',
      token: { sub: 'uid-1' },
    });
  });

  it('answers trusted preflight requests with reflected CORS headers', async () => {
    const response = await handler({
      httpMethod: 'OPTIONS',
      headers: { origin: 'https://app.example.com' },
      body: null,
      path: '/.netlify/functions/fhir-api/metadata',
    });
    const headers = response.headers as Record<string, string>;

    expect(response.statusCode).toBe(200);
    expect(headers['Access-Control-Allow-Origin']).toBe('https://app.example.com');
    expect(headers['Access-Control-Allow-Methods']).toBe('GET,OPTIONS');
  });

  it('rejects untrusted browser origins', async () => {
    const response = await handler({
      httpMethod: 'GET',
      headers: { origin: 'https://evil.example.com' },
      body: null,
      path: '/.netlify/functions/fhir-api/metadata',
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).toContain('Origin not allowed');
    expect(getFirebaseServerMock).not.toHaveBeenCalled();
  });

  it('returns a capability statement for metadata requests', async () => {
    const response = await handler({
      httpMethod: 'GET',
      headers: {
        origin: 'https://app.example.com',
        authorization: 'Bearer token-123',
      },
      body: null,
      path: '/.netlify/functions/fhir-api/metadata',
    });
    const headers = response.headers as Record<string, string>;

    expect(response.statusCode).toBe(200);
    expect(headers['Content-Type']).toBe('application/fhir+json');
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        resourceType: 'CapabilityStatement',
      })
    );
  });

  it('returns 401 when the request has no bearer token', async () => {
    extractBearerTokenMock.mockImplementation(() => {
      throw new Error('Missing Authorization bearer token.');
    });

    const response = await handler({
      httpMethod: 'GET',
      headers: { origin: 'https://app.example.com' },
      body: null,
      path: '/.netlify/functions/fhir-api/metadata',
    });

    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        resourceType: 'OperationOutcome',
        issue: [expect.objectContaining({ code: 'login' })],
      })
    );
    expect(authorizeFhirRequestMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the authenticated user role cannot access FHIR', async () => {
    authorizeFhirRequestMock.mockRejectedValue(new Error("Access denied for role 'viewer'."));

    const response = await handler({
      httpMethod: 'GET',
      headers: {
        origin: 'https://app.example.com',
        authorization: 'Bearer token-123',
      },
      body: null,
      path: '/.netlify/functions/fhir-api/metadata',
    });

    expect(response.statusCode).toBe(403);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        resourceType: 'OperationOutcome',
        issue: [expect.objectContaining({ code: 'forbidden' })],
      })
    );
  });

  it('reads patient resources from the primary document path', async () => {
    getDocMock.mockResolvedValue({
      exists: () => true,
      data: () => ({ rut: '12345678-9' }),
    });

    const response = await handler({
      httpMethod: 'GET',
      headers: {
        origin: 'https://app.example.com',
        authorization: 'Bearer token-123',
      },
      body: null,
      path: '/.netlify/functions/fhir-api/Patient/12345678-9',
    });

    expect(docMock).toHaveBeenCalledWith(
      { kind: 'firestore' },
      'hospitals/hanga_roa/patients',
      '12345678-9'
    );
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toEqual({
      resourceType: 'Patient',
      id: '12345678-9',
    });
  });

  it('returns operation outcome payloads for missing patient ids', async () => {
    const response = await handler({
      httpMethod: 'GET',
      headers: {
        origin: 'https://app.example.com',
        authorization: 'Bearer token-123',
      },
      body: null,
      path: '/.netlify/functions/fhir-api/Patient',
    });

    expect(response.statusCode).toBe(400);
    expect(JSON.parse(response.body)).toEqual(
      expect.objectContaining({
        resourceType: 'OperationOutcome',
        issue: [expect.objectContaining({ code: 'required' })],
      })
    );
  });
});
