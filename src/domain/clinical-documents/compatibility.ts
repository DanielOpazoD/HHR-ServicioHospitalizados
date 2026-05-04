import type { ClinicalDocumentRecord } from '@/domain/clinical-documents/entities';
import { getClinicalDocumentDefinition } from '@/domain/clinical-documents/definitions';
import {
  CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION,
  LEGACY_CLINICAL_DOCUMENT_SCHEMA_VERSION,
} from '@/domain/clinical-documents/schema';

export const resolveClinicalDocumentSchemaVersion = (
  record: Partial<ClinicalDocumentRecord> | null | undefined
): number => {
  const rawVersion = record?.schemaVersion;
  if (typeof rawVersion !== 'number' || !Number.isFinite(rawVersion)) {
    return LEGACY_CLINICAL_DOCUMENT_SCHEMA_VERSION;
  }
  return Math.max(LEGACY_CLINICAL_DOCUMENT_SCHEMA_VERSION, Math.floor(rawVersion));
};

const applyClinicalDocumentDefinitionDefaults = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => {
  const definition = getClinicalDocumentDefinition(record.documentType);
  const normalizedSections = definition.sectionNormalizers.reduce(
    (sections, normalize) => normalize(sections),
    record.sections
  );
  const patientFields = record.patientFields.map(field => ({
    ...field,
    label: definition.resolvePatientFieldLabel?.(field) || field.label,
  }));

  return {
    ...record,
    schemaVersion: CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION,
    status:
      record.status === 'signed' || record.status === 'ready_for_signature'
        ? 'draft'
        : record.status,
    // Preserve the lock only when a recognized lock reason is recorded.
    // Bare `isLocked: true` without metadata is the legacy signature-era
    // lock (since retired) and must reset to false. The new
    // episode-close lock always carries `lockedReason='episode_closed'`
    // and survives both reads and persistence.
    isLocked: Boolean(record.lockedReason),
    patientFields,
    sections: normalizedSections,
    patientInfoTitle: record.patientInfoTitle || 'Información del Paciente',
    footerMedicoLabel: record.footerMedicoLabel || 'Médico',
    footerEspecialidadLabel: record.footerEspecialidadLabel || 'Especialidad',
    audit: {
      ...record.audit,
      signatureRevocations: Array.isArray(record.audit.signatureRevocations)
        ? record.audit.signatureRevocations
        : [],
    },
  };
};

export const hydrateClinicalDocumentV1ToCurrent = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => applyClinicalDocumentDefinitionDefaults(record);

export const hydrateLegacyClinicalDocument = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => {
  const schemaVersion = resolveClinicalDocumentSchemaVersion(record);
  if (schemaVersion <= LEGACY_CLINICAL_DOCUMENT_SCHEMA_VERSION) {
    return hydrateClinicalDocumentV1ToCurrent(record);
  }
  return applyClinicalDocumentDefinitionDefaults(record);
};

export const normalizeClinicalDocumentForPersistence = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => applyClinicalDocumentDefinitionDefaults(record);
