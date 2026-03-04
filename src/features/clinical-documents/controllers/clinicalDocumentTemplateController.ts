import type {
  ClinicalDocumentTemplate,
  ClinicalDocumentType,
} from '@/features/clinical-documents/domain/entities';
import { CLINICAL_DOCUMENT_TEMPLATES } from '@/features/clinical-documents/domain/rules';

export const listActiveClinicalDocumentTemplates = (): ClinicalDocumentTemplate[] =>
  Object.values(CLINICAL_DOCUMENT_TEMPLATES)
    .filter(template => template.status === 'active')
    .sort((left, right) => left.name.localeCompare(right.name, 'es'));

export const getClinicalDocumentTypeLabel = (documentType: ClinicalDocumentType): string => {
  switch (documentType) {
    case 'epicrisis':
      return 'Epicrisis';
    case 'evolucion':
      return 'Evolución';
    case 'informe_medico':
      return 'Informe';
    case 'epicrisis_traslado':
      return 'Epicrisis traslado';
    case 'otro':
      return 'Otro';
    default:
      return documentType;
  }
};
