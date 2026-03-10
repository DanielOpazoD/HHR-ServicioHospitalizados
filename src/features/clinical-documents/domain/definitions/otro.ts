import {
  createBaseClinicalDocumentDefinition,
  type ClinicalDocumentDefinition,
} from '@/features/clinical-documents/domain/definitions/base';

export const OTRO_CLINICAL_DOCUMENT_DEFINITION: ClinicalDocumentDefinition =
  createBaseClinicalDocumentDefinition('otro');
