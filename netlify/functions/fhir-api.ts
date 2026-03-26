import { doc, getDoc, collection, query, where, getDocs, type Firestore } from 'firebase/firestore';
import { getFirebaseServer } from './lib/firebase-server';
import { mapMasterPatientToFhir, mapEncounterToFhir } from '../../src/services/utils/fhirMappers';
import { MasterPatient, DailyRecord } from '../../src/types';
import {
  buildCorsHeaders,
  buildJsonResponse,
  getRequestOrigin,
  isOriginAllowed,
  type NetlifyEventLike,
} from './lib/http';
import { authorizeRoleRequest, extractBearerToken } from './lib/firebase-auth';

const hospitalId = 'hanga_roa'; // Could be dynamic via headers in future
const FHIR_ALLOWED_ROLES = new Set([
  'admin',
  'nurse_hospital',
  'doctor_urgency',
  'doctor_specialist',
]);

const buildOperationOutcomeResponse = (
  statusCode: number,
  code: string,
  diagnostics: string,
  requestOrigin?: string
) =>
  buildJsonResponse(
    statusCode,
    {
      resourceType: 'OperationOutcome',
      issue: [{ severity: 'error', code, diagnostics }],
    },
    {
      requestOrigin,
      contentType: 'application/fhir+json',
    }
  );

export const handler = async (event: NetlifyEventLike) => {
  const requestOrigin = getRequestOrigin(event);
  const corsHeaders = buildCorsHeaders(requestOrigin, {
    allowedHeaders: 'Content-Type, Authorization, Accept',
    allowedMethods: 'GET,OPTIONS',
  });

  if (!isOriginAllowed(requestOrigin)) {
    return buildJsonResponse(403, { error: 'Origin not allowed' }, { requestOrigin });
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'GET') {
    return buildOperationOutcomeResponse(405, 'forbidden', 'Method not allowed', requestOrigin);
  }

  const pathParts = (event.path || '').split('/').filter(Boolean);
  const fhirIndex = pathParts.findIndex(p => p === 'fhir-api');
  const resourceType = fhirIndex >= 0 ? pathParts[fhirIndex + 1] : undefined;
  const resourceId = fhirIndex >= 0 ? pathParts[fhirIndex + 2] : undefined;

  try {
    const { db } = getFirebaseServer();
    const authorizationHeader =
      typeof event.headers?.authorization === 'string'
        ? event.headers.authorization
        : typeof event.headers?.Authorization === 'string'
          ? event.headers.Authorization
          : undefined;

    try {
      extractBearerToken(authorizationHeader);
    } catch (error) {
      return buildOperationOutcomeResponse(
        401,
        'login',
        error instanceof Error ? error.message : 'Authentication required.',
        requestOrigin
      );
    }

    try {
      await authorizeRoleRequest(db, authorizationHeader, FHIR_ALLOWED_ROLES);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'FHIR authorization failed.';
      const statusCode =
        message.includes('Access denied') || message.includes('no email claim') ? 403 : 401;
      const code = statusCode === 403 ? 'forbidden' : 'login';

      return buildOperationOutcomeResponse(statusCode, code, message, requestOrigin);
    }

    if (resourceType === 'Patient') {
      return await handlePatientRead(db, resourceId, requestOrigin);
    }

    if (resourceType === 'Encounter') {
      return await handleEncounterRead(db, resourceId, requestOrigin);
    }

    if (resourceType === 'metadata' || !resourceType) {
      return handleCapabilityStatement(requestOrigin);
    }

    return buildOperationOutcomeResponse(
      404,
      'not-found',
      `Resource type '${resourceType}' not supported or not found`,
      requestOrigin
    );
  } catch (error: unknown) {
    console.error('[FHIR API] Error:', error);
    return buildOperationOutcomeResponse(
      500,
      'exception',
      error instanceof Error ? error.message : String(error),
      requestOrigin
    );
  }
};

async function handlePatientRead(db: Firestore, id: string | undefined, requestOrigin?: string) {
  if (!id) {
    return buildOperationOutcomeResponse(
      400,
      'required',
      'Patient ID (RUT) is required',
      requestOrigin
    );
  }

  const patientRef = doc(db, `hospitals/${hospitalId}/patients`, id);
  const snap = await getDoc(patientRef);

  if (!snap.exists()) {
    const patientsColl = collection(db, `hospitals/${hospitalId}/patients`);
    const q = query(patientsColl, where('rut', '==', id));
    const qSnap = await getDocs(q);
    if (!qSnap.empty) {
      const data = qSnap.docs[0].data() as MasterPatient;
      return buildJsonResponse(200, mapMasterPatientToFhir(data), {
        requestOrigin,
        contentType: 'application/fhir+json',
      });
    }
  }

  if (snap.exists()) {
    const data = snap.data() as MasterPatient;
    return buildJsonResponse(200, mapMasterPatientToFhir(data), {
      requestOrigin,
      contentType: 'application/fhir+json',
    });
  }

  return buildOperationOutcomeResponse(
    404,
    'not-found',
    `Patient with ID '${id}' not found`,
    requestOrigin
  );
}

async function handleEncounterRead(db: Firestore, id: string | undefined, requestOrigin?: string) {
  if (!id || !id.startsWith('enc-')) {
    return buildOperationOutcomeResponse(
      400,
      'invalid',
      'Invalid Encounter ID format. Expected enc-YYYY-MM-DD-{bedId}',
      requestOrigin
    );
  }

  const parts = id.split('-');
  if (parts.length < 5) {
    return buildOperationOutcomeResponse(
      400,
      'invalid',
      'Invalid Encounter ID format.',
      requestOrigin
    );
  }

  const date = `${parts[1]}-${parts[2]}-${parts[3]}`;
  const bedId = parts.slice(4).join('-');

  const recordRef = doc(db, `hospitals/${hospitalId}/dailyRecords`, date);
  const snap = await getDoc(recordRef);

  if (snap.exists()) {
    const record = snap.data() as DailyRecord;
    const patient = record.beds[bedId];

    if (patient && patient.patientName) {
      return buildJsonResponse(200, mapEncounterToFhir(patient, hospitalId), {
        requestOrigin,
        contentType: 'application/fhir+json',
      });
    }
  }

  return buildOperationOutcomeResponse(
    404,
    'not-found',
    `Encounter with ID '${id}' not found`,
    requestOrigin
  );
}

function handleCapabilityStatement(requestOrigin?: string) {
  return buildJsonResponse(
    200,
    {
      resourceType: 'CapabilityStatement',
      status: 'active',
      date: new Date().toISOString(),
      kind: 'instance',
      software: { name: 'HHR Hospital Tracker FHIR API', version: '1.0.0' },
      implementation: { description: 'FHIR R4 Endpoint for Hospital Hanga Roa' },
      fhirVersion: '4.0.1',
      format: ['application/fhir+json'],
      rest: [
        {
          mode: 'server',
          resource: [
            { type: 'Patient', interaction: [{ code: 'read' }] },
            { type: 'Encounter', interaction: [{ code: 'read' }] },
          ],
        },
      ],
    },
    {
      requestOrigin,
      contentType: 'application/fhir+json',
    }
  );
}
