import type {
  ClinicalDocumentRecord,
  ClinicalDocumentType,
  ClinicalDocumentValidationIssue,
} from '@/features/clinical-documents/domain/entities';
import { CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION } from '@/features/clinical-documents/domain/schema';

export type ClinicalDocumentSectionRendererId = 'standard' | 'plan_subsections';

export interface ClinicalDocumentPrintOptions {
  pageSize: 'letter';
  pageMarginMm: number;
  allowBrowserScale: boolean;
  manualPagination: boolean;
  mode: 'inline_browser_print';
}

export interface ClinicalDocumentDefinition {
  documentType: ClinicalDocumentType;
  schemaVersion: number;
  sectionRenderers: Partial<Record<string, ClinicalDocumentSectionRendererId>>;
  sectionNormalizers: Array<
    (sections: ClinicalDocumentRecord['sections']) => ClinicalDocumentRecord['sections']
  >;
  sectionValidators: Array<(record: ClinicalDocumentRecord) => ClinicalDocumentValidationIssue[]>;
  printOptions: ClinicalDocumentPrintOptions;
  resolvePatientFieldLabel?: (
    field: ClinicalDocumentRecord['patientFields'][number]
  ) => string | null;
}

export const CLINICAL_DOCUMENT_DEFAULT_PRINT_OPTIONS: ClinicalDocumentPrintOptions = {
  pageSize: 'letter',
  pageMarginMm: 8,
  allowBrowserScale: true,
  manualPagination: false,
  mode: 'inline_browser_print',
};

export const createBaseClinicalDocumentDefinition = (
  documentType: ClinicalDocumentType
): ClinicalDocumentDefinition => ({
  documentType,
  schemaVersion: CURRENT_CLINICAL_DOCUMENT_SCHEMA_VERSION,
  sectionRenderers: {},
  sectionNormalizers: [],
  sectionValidators: [],
  printOptions: CLINICAL_DOCUMENT_DEFAULT_PRINT_OPTIONS,
});
