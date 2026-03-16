import { createDomainObservability } from '@/services/observability/domainObservability';

export const clinicalDocumentObservability = createDomainObservability(
  'clinical_document',
  'ClinicalDocuments'
);
