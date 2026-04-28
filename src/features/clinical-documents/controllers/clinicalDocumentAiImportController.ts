import { z } from 'zod';
import type { ClinicalDocumentSection } from '@/features/clinical-documents/domain/entities';

export const CLINICAL_DOCUMENT_AI_IMPORT_MAX_FILE_BYTES = 8 * 1024 * 1024;
const CLINICAL_DOCUMENT_AI_IMPORT_MIN_TEXT_LENGTH = 80;

export interface ClinicalDocumentAiImportPayload {
  antecedentes: string;
  historiaEvolucionClinica: string;
  examenesComplementarios: string;
  diagnosticosEgreso: string;
  planEgreso: string;
}

interface ClinicalDocumentAiImportParseSuccess {
  status: 'success';
  data: ClinicalDocumentAiImportPayload;
}

interface ClinicalDocumentAiImportParseFailure {
  status: 'failed';
  data: null;
  error: string;
}

export type ClinicalDocumentAiImportParseResult =
  | ClinicalDocumentAiImportParseSuccess
  | ClinicalDocumentAiImportParseFailure;

export interface ClinicalDocumentAiImportValidationResult {
  ok: boolean;
  message?: string;
}

export interface ClinicalDocumentAiImportFileLike {
  name: string;
  type?: string;
  size: number;
}

const clinicalDocumentAiImportPayloadSchema = z.object({
  antecedentes: z.string(),
  historiaEvolucionClinica: z.string(),
  examenesComplementarios: z.string(),
  diagnosticosEgreso: z.string(),
  planEgreso: z.string(),
});

const escapeClinicalDocumentHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const normalizeClinicalDocumentAiImportText = (value: string): string =>
  value
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const ADMINISTRATIVE_PATIENT_IDENTIFIER_PATTERNS = [
  /\b(?:nombre(?:\s+completo)?|paciente)\s*:\s*[^.;\n]+[.;]?/gi,
  /\b(?:rut|run|r\.?\s*u\.?\s*t\.?)\s*:?\s*[0-9.\-kK]+[.;]?/gi,
];

const removeAdministrativePatientIdentifiers = (value: string): string => {
  const normalized = normalizeClinicalDocumentAiImportText(value);
  if (!normalized) return '';

  return normalizeClinicalDocumentAiImportText(
    normalized
      .split('\n')
      .map(line =>
        ADMINISTRATIVE_PATIENT_IDENTIFIER_PATTERNS.reduce(
          (current, pattern) => current.replace(pattern, ''),
          line
        )
          .replace(/^[\s,;.:/-]+|[\s,;:/-]+$/g, '')
          .trim()
      )
      .filter(Boolean)
      .join('\n')
  );
};

export const buildClinicalDocumentAiImportSectionHtml = (value: string): string => {
  const normalized = normalizeClinicalDocumentAiImportText(value);
  if (!normalized) return '';

  return normalized
    .split(/\n{2,}/)
    .map(paragraph => `<p>${escapeClinicalDocumentHtml(paragraph).replace(/\n/g, '<br>')}</p>`)
    .join('');
};

export const parseClinicalDocumentAiImportJson = (
  value: string
): ClinicalDocumentAiImportParseResult => {
  try {
    const parsed = clinicalDocumentAiImportPayloadSchema.safeParse(JSON.parse(value));
    if (!parsed.success) {
      return {
        status: 'failed',
        data: null,
        error: 'La respuesta IA no tiene el formato esperado para generar la epicrisis.',
      };
    }

    return {
      status: 'success',
      data: {
        antecedentes: removeAdministrativePatientIdentifiers(parsed.data.antecedentes),
        historiaEvolucionClinica: removeAdministrativePatientIdentifiers(
          parsed.data.historiaEvolucionClinica
        ),
        examenesComplementarios: removeAdministrativePatientIdentifiers(
          parsed.data.examenesComplementarios
        ),
        diagnosticosEgreso: removeAdministrativePatientIdentifiers(parsed.data.diagnosticosEgreso),
        planEgreso: removeAdministrativePatientIdentifiers(parsed.data.planEgreso),
      },
    };
  } catch {
    return {
      status: 'failed',
      data: null,
      error: 'La respuesta IA no pudo leerse como JSON valido.',
    };
  }
};

export const buildClinicalDocumentAiImportSections = (
  payload: ClinicalDocumentAiImportPayload
): ClinicalDocumentSection[] => [
  {
    id: 'antecedentes',
    title: 'Antecedentes',
    content: buildClinicalDocumentAiImportSectionHtml(payload.antecedentes),
    order: 0,
    required: true,
    visible: true,
  },
  {
    id: 'historia-evolucion',
    title: 'Historia y evolución clínica',
    content: buildClinicalDocumentAiImportSectionHtml(payload.historiaEvolucionClinica),
    order: 1,
    required: true,
    visible: true,
  },
  {
    id: 'examenes-complementarios',
    title: 'Exámenes complementarios',
    content: buildClinicalDocumentAiImportSectionHtml(payload.examenesComplementarios),
    order: 2,
    required: false,
    visible: true,
  },
  {
    id: 'diagnosticos',
    title: 'Diagnósticos de egreso',
    content: buildClinicalDocumentAiImportSectionHtml(payload.diagnosticosEgreso),
    order: 3,
    required: false,
    visible: true,
  },
  {
    id: 'plan',
    title: 'Plan de egreso',
    content: buildClinicalDocumentAiImportSectionHtml(payload.planEgreso),
    order: 4,
    required: true,
    visible: true,
  },
];

export const validateClinicalDocumentAiImportFile = (
  file: ClinicalDocumentAiImportFileLike
): ClinicalDocumentAiImportValidationResult => {
  if (file.size > CLINICAL_DOCUMENT_AI_IMPORT_MAX_FILE_BYTES) {
    return {
      ok: false,
      message: 'El archivo supera el maximo permitido de 8 MB.',
    };
  }

  const normalizedName = file.name.toLowerCase();
  const normalizedType = file.type?.toLowerCase() || '';
  const isPdf = normalizedName.endsWith('.pdf') || normalizedType === 'application/pdf';
  const isDocx =
    normalizedName.endsWith('.docx') ||
    normalizedType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isPdf && !isDocx) {
    return {
      ok: false,
      message: 'Solo se aceptan archivos PDF o DOCX para importar con IA.',
    };
  }

  return { ok: true };
};

export const validateClinicalDocumentAiImportSourceText = (
  value: string
): ClinicalDocumentAiImportValidationResult => {
  if (
    normalizeClinicalDocumentAiImportText(value).length <
    CLINICAL_DOCUMENT_AI_IMPORT_MIN_TEXT_LENGTH
  ) {
    return {
      ok: false,
      message: 'No se pudo extraer texto util del archivo.',
    };
  }

  return { ok: true };
};
