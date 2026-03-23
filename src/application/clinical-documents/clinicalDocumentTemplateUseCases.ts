import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';
import type { ClinicalDocumentTemplate } from '@/features/clinical-documents/public';
import { ClinicalDocumentTemplateRepository } from '@/services/repositories/ClinicalDocumentTemplateRepository';

export const executeListActiveClinicalDocumentTemplates = async (
  hospitalId: string
): Promise<ApplicationOutcome<ClinicalDocumentTemplate[]>> => {
  try {
    const templates = await ClinicalDocumentTemplateRepository.listActive(hospitalId);
    return createApplicationSuccess(templates);
  } catch (error) {
    return createApplicationFailed(
      [],
      [
        {
          kind: 'unknown',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar las plantillas clínicas.',
        },
      ]
    );
  }
};

export const executeSeedClinicalDocumentTemplates = async (
  hospitalId: string
): Promise<ApplicationOutcome<ClinicalDocumentTemplate[]>> => {
  try {
    await ClinicalDocumentTemplateRepository.seedDefaults(hospitalId);
    const templates = await ClinicalDocumentTemplateRepository.listActive(hospitalId);
    return createApplicationSuccess(templates);
  } catch (error) {
    return createApplicationFailed(
      [],
      [
        {
          kind: 'unknown',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudieron inicializar las plantillas clínicas.',
        },
      ]
    );
  }
};
