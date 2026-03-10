import { createHash } from '@/features/clinical-documents/utils/hash';
import type {
  ClinicalDocumentAuditActor,
  ClinicalDocumentEpisodeContext,
  ClinicalDocumentPatientField,
  ClinicalDocumentRecord,
  ClinicalDocumentSection,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents/domain/entities';
import { stripClinicalDocumentHtml } from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';
import {
  CLINICAL_DOCUMENT_TEMPLATES,
  DEFAULT_CLINICAL_DOCUMENT_TEMPLATE_ID,
} from '@/features/clinical-documents/domain/rules';
import { CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION } from '@/features/clinical-documents/domain/schema';

const clonePatientFields = (
  template: ClinicalDocumentTemplate,
  values: Record<string, string>
): ClinicalDocumentPatientField[] =>
  template.patientFields.map(field => ({
    ...field,
    value: values[field.id] || '',
    visible: field.visible ?? true,
  }));

const cloneSections = (template: ClinicalDocumentTemplate): ClinicalDocumentSection[] =>
  template.sections.map(section => ({
    id: section.id,
    title: section.title,
    content: '',
    order: section.order,
    kind: section.kind,
    required: section.required,
    visible: section.visible ?? true,
  }));

export const getClinicalDocumentTemplate = (templateId?: string): ClinicalDocumentTemplate =>
  CLINICAL_DOCUMENT_TEMPLATES[templateId || DEFAULT_CLINICAL_DOCUMENT_TEMPLATE_ID] ||
  CLINICAL_DOCUMENT_TEMPLATES[DEFAULT_CLINICAL_DOCUMENT_TEMPLATE_ID];

export const buildClinicalDocumentRenderedText = (
  record: Pick<
    ClinicalDocumentRecord,
    | 'title'
    | 'patientInfoTitle'
    | 'patientFields'
    | 'sections'
    | 'footerMedicoLabel'
    | 'footerEspecialidadLabel'
    | 'medico'
    | 'especialidad'
  >
): string => {
  const patientBlock = record.patientFields
    .filter(field => field.visible !== false)
    .map(field => `${field.label}: ${field.value || '—'}`)
    .join('\n');
  const sectionsBlock = record.sections
    .filter(section => section.visible !== false)
    .map(
      section =>
        `${section.title}\n${stripClinicalDocumentHtml(section.content) || 'Sin contenido registrado.'}`
    )
    .join('\n\n');

  return [
    record.title,
    record.patientInfoTitle || 'Información del Paciente',
    patientBlock,
    sectionsBlock,
    `${record.footerMedicoLabel || 'Médico'}: ${record.medico || '—'}`,
    `${record.footerEspecialidadLabel || 'Especialidad'}: ${record.especialidad || '—'}`,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();
};

interface CreateClinicalDocumentDraftParams {
  templateId?: string;
  hospitalId: string;
  actor: ClinicalDocumentAuditActor;
  episode: ClinicalDocumentEpisodeContext;
  patientFieldValues: Record<string, string>;
  medico: string;
  especialidad: string;
}

export const createClinicalDocumentDraft = ({
  templateId,
  hospitalId,
  actor,
  episode,
  patientFieldValues,
  medico,
  especialidad,
}: CreateClinicalDocumentDraftParams): ClinicalDocumentRecord => {
  const template = getClinicalDocumentTemplate(templateId);
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : `clinical-document-${Date.now()}`;
  const now = new Date().toISOString();
  const patientFields = clonePatientFields(template, patientFieldValues);
  const sections = cloneSections(template);

  const draft: ClinicalDocumentRecord = {
    id,
    schemaVersion: CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION,
    hospitalId,
    documentType: template.documentType,
    templateId: template.id,
    templateVersion: template.version,
    title: template.title,
    patientInfoTitle: template.defaultPatientInfoTitle,
    footerMedicoLabel: template.defaultFooterMedicoLabel,
    footerEspecialidadLabel: template.defaultFooterEspecialidadLabel,
    patientRut: episode.patientRut,
    patientName: episode.patientName,
    episodeKey: episode.episodeKey,
    admissionDate: episode.admissionDate,
    sourceDailyRecordDate: episode.sourceDailyRecordDate,
    sourceBedId: episode.sourceBedId,
    patientFields,
    sections,
    medico,
    especialidad,
    status: 'draft',
    isLocked: false,
    isActiveEpisodeDocument: true,
    currentVersion: 1,
    versionHistory: [
      {
        version: 1,
        savedAt: now,
        savedBy: actor,
        reason: 'manual',
      },
    ],
    audit: {
      createdAt: now,
      createdBy: actor,
      updatedAt: now,
      updatedBy: actor,
    },
    renderedText: '',
    integrityHash: '',
  };

  const renderedText = buildClinicalDocumentRenderedText(draft);
  return {
    ...draft,
    renderedText,
    integrityHash: createHash(renderedText),
  };
};
