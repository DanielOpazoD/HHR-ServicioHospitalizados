import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { getClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions';
import { normalizeClinicalDocumentSectionTitle } from '@/features/clinical-documents/controllers/clinicalDocumentSectionTitleController';
import {
  CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION,
  LEGACY_CLINICAL_DOCUMENT_SCHEMA_VERSION,
} from '@/features/clinical-documents/domain/schema';

/**
 * Extracts and normalizes the schema version from a clinical document record.
 * Falls back to the legacy version for missing or invalid values.
 * @param record - Partial or nullable clinical document record
 * @returns Resolved integer schema version, never below legacy
 */
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

  return {
    ...record,
    schemaVersion: CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION,
    status:
      record.status === 'signed' || record.status === 'ready_for_signature'
        ? 'draft'
        : record.status,
    isLocked: false,
    sections: normalizedSections.map((section, index) => ({
      ...section,
      title: normalizeClinicalDocumentSectionTitle(section.title, `Sección ${index + 1}`),
    })),
    patientInfoTitle: record.patientInfoTitle || 'Información del Paciente',
    footerMedicoLabel: record.footerMedicoLabel || 'Médico',
    footerEspecialidadLabel: record.footerEspecialidadLabel || 'Especialidad',
    annexIncludedInPrint: record.annexIncludedInPrint ?? true,
    includePatientSignature: record.includePatientSignature ?? true,
    audit: {
      ...record.audit,
      signatureRevocations: Array.isArray(record.audit.signatureRevocations)
        ? record.audit.signatureRevocations
        : [],
    },
  };
};

/**
 * Migrates a v1 clinical document to the current schema by applying definition defaults.
 * @param record - The v1 clinical document record
 * @returns Record hydrated to the current schema version
 */
export const hydrateClinicalDocumentV1ToCurrent = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => applyClinicalDocumentDefinitionDefaults(record);

/**
 * Hydrates a clinical document of any legacy schema version to the current format.
 * Routes through version-specific migration when needed.
 * @param record - The persisted clinical document record
 * @returns Fully migrated record compatible with the current schema
 */
export const hydrateLegacyClinicalDocument = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => {
  const schemaVersion = resolveClinicalDocumentSchemaVersion(record);

  if (schemaVersion <= LEGACY_CLINICAL_DOCUMENT_SCHEMA_VERSION) {
    return hydrateClinicalDocumentV1ToCurrent(record);
  }

  return applyClinicalDocumentDefinitionDefaults(record);
};

/**
 * Normalizes a clinical document before writing it to the persistence layer.
 * Ensures all definition-level defaults and section normalizers are applied.
 * @param record - The clinical document to persist
 * @returns Normalized record ready for storage
 */
export const normalizeClinicalDocumentForPersistence = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => applyClinicalDocumentDefinitionDefaults(record);
