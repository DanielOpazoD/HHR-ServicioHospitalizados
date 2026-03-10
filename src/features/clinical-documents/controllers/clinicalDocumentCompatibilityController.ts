import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { getClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions';
import {
  CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION,
  LEGACY_CLINICAL_DOCUMENT_SCHEMA_VERSION,
} from '@/features/clinical-documents/domain/schema';

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
