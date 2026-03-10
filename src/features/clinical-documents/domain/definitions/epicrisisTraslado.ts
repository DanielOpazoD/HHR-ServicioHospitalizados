import {
  createBaseClinicalDocumentDefinition,
  type ClinicalDocumentDefinition,
} from '@/features/clinical-documents/domain/definitions/base';

export const EPICRISIS_TRASLADO_CLINICAL_DOCUMENT_DEFINITION: ClinicalDocumentDefinition =
  createBaseClinicalDocumentDefinition('epicrisis_traslado');
