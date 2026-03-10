import { z } from 'zod';

import type {
  ClinicalDocumentRecord,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents/domain/entities';

const clinicalDocumentTypeSchema = z.enum([
  'epicrisis',
  'evolucion',
  'informe_medico',
  'epicrisis_traslado',
  'otro',
]);

const clinicalDocumentStatusSchema = z.enum(['draft', 'ready_for_signature', 'signed', 'archived']);

const auditActorSchema = z.object({
  uid: z.string(),
  email: z.string(),
  displayName: z.string(),
  role: z.string(),
});

const patientFieldSchema = z.object({
  id: z.string(),
  label: z.string(),
  value: z.string(),
  type: z.enum(['text', 'date', 'number', 'time']),
  placeholder: z.string().optional(),
  readonly: z.boolean().optional(),
  visible: z.boolean().optional(),
});

const sectionSchema = z.object({
  id: z.string(),
  title: z.string(),
  content: z.string(),
  kind: z.enum(['standard', 'clinical-update']).optional(),
  updateDate: z.string().optional(),
  updateTime: z.string().optional(),
  order: z.number(),
  required: z.boolean().optional(),
  visible: z.boolean().optional(),
});

const versionHistorySchema = z.object({
  version: z.number(),
  savedAt: z.string(),
  savedBy: auditActorSchema,
  reason: z.enum(['autosave', 'manual', 'signature', 'unsign', 'admin_fix']),
});

const pdfMetaSchema = z.object({
  fileId: z.string().optional(),
  webViewLink: z.string().optional(),
  folderPath: z.string().optional(),
  exportedAt: z.string().optional(),
  exportStatus: z.enum(['pending', 'exported', 'failed']).optional(),
  exportError: z.string().optional(),
});

export const clinicalDocumentRecordSchema = z.object({
  id: z.string(),
  schemaVersion: z.number().optional(),
  hospitalId: z.string(),
  documentType: clinicalDocumentTypeSchema,
  templateId: z.string(),
  templateVersion: z.number(),
  title: z.string(),
  patientInfoTitle: z.string(),
  footerMedicoLabel: z.string(),
  footerEspecialidadLabel: z.string(),
  patientRut: z.string(),
  patientName: z.string(),
  episodeKey: z.string(),
  admissionDate: z.string().optional(),
  sourceDailyRecordDate: z.string().optional(),
  sourceBedId: z.string().optional(),
  patientFields: z.array(patientFieldSchema),
  sections: z.array(sectionSchema),
  medico: z.string(),
  especialidad: z.string(),
  status: clinicalDocumentStatusSchema,
  isLocked: z.boolean(),
  isActiveEpisodeDocument: z.boolean(),
  currentVersion: z.number(),
  versionHistory: z.array(versionHistorySchema),
  audit: z.object({
    createdAt: z.string(),
    createdBy: auditActorSchema,
    updatedAt: z.string(),
    updatedBy: auditActorSchema,
    signedAt: z.string().optional(),
    signedBy: auditActorSchema.optional(),
    unsignedAt: z.string().optional(),
    unsignedBy: auditActorSchema.optional(),
    signatureRevocations: z
      .array(
        z.object({
          revokedAt: z.string(),
          revokedBy: auditActorSchema,
          previousSignedAt: z.string().optional(),
          reason: z.string(),
        })
      )
      .optional(),
    archivedAt: z.string().optional(),
    archivedBy: auditActorSchema.optional(),
  }),
  pdf: pdfMetaSchema.optional(),
  renderedText: z.string().optional(),
  integrityHash: z.string().optional(),
});

export const clinicalDocumentTemplateSchema = z.object({
  id: z.string(),
  documentType: clinicalDocumentTypeSchema,
  name: z.string(),
  title: z.string(),
  defaultPatientInfoTitle: z.string(),
  defaultFooterMedicoLabel: z.string(),
  defaultFooterEspecialidadLabel: z.string(),
  version: z.number(),
  patientFields: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      type: z.enum(['text', 'date', 'number', 'time']),
      placeholder: z.string().optional(),
      readonly: z.boolean().optional(),
      visible: z.boolean().optional(),
    })
  ),
  sections: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      order: z.number(),
      kind: z.enum(['standard', 'clinical-update']).optional(),
      required: z.boolean().optional(),
      visible: z.boolean().optional(),
    })
  ),
  allowCustomTitle: z.boolean(),
  allowAddSection: z.boolean(),
  allowClinicalUpdateSections: z.boolean(),
  status: z.enum(['active', 'archived']),
});

export const parseClinicalDocumentRecord = (record: unknown): ClinicalDocumentRecord =>
  clinicalDocumentRecordSchema.parse(record) as ClinicalDocumentRecord;

export const safeParseClinicalDocumentRecord = (record: unknown) =>
  clinicalDocumentRecordSchema.safeParse(record);

export const parseClinicalDocumentTemplate = (template: unknown): ClinicalDocumentTemplate =>
  clinicalDocumentTemplateSchema.parse(template) as ClinicalDocumentTemplate;

export const safeParseClinicalDocumentTemplate = (template: unknown) =>
  clinicalDocumentTemplateSchema.safeParse(template);

export const formatClinicalDocumentContractIssues = (
  issues: Array<{ path: Array<string | number>; message: string }>
): string[] => issues.map(issue => `${issue.path.join('.') || 'root'}: ${issue.message}`);
