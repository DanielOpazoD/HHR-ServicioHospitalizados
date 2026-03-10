import {
  createBaseClinicalDocumentDefinition,
  type ClinicalDocumentDefinition,
} from '@/features/clinical-documents/domain/definitions/base';

export const INFORME_MEDICO_CLINICAL_DOCUMENT_DEFINITION: ClinicalDocumentDefinition =
  createBaseClinicalDocumentDefinition('informe_medico');
