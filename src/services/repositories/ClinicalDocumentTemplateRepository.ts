import { db } from '@/services/infrastructure/db';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type { ClinicalDocumentTemplate } from '@/features/clinical-documents/domain/entities';
import { CLINICAL_DOCUMENT_TEMPLATES } from '@/features/clinical-documents/domain/rules';

const getClinicalDocumentTemplatesCollectionPath = (
  hospitalId: string = getActiveHospitalId()
): string => `hospitals/${hospitalId}/clinicalDocumentTemplates`;

const defaultTemplates = Object.values(CLINICAL_DOCUMENT_TEMPLATES);

const normalizeTemplate = (
  raw: Partial<ClinicalDocumentTemplate> | null | undefined
): ClinicalDocumentTemplate | null => {
  if (!raw?.id || !raw.documentType || !raw.name || !raw.title || typeof raw.version !== 'number') {
    return null;
  }

  return {
    id: raw.id,
    documentType: raw.documentType,
    name: raw.name,
    title: raw.title,
    version: raw.version,
    patientFields: Array.isArray(raw.patientFields) ? raw.patientFields : [],
    sections: Array.isArray(raw.sections) ? raw.sections : [],
    allowCustomTitle: Boolean(raw.allowCustomTitle),
    allowAddSection: Boolean(raw.allowAddSection),
    allowClinicalUpdateSections: Boolean(raw.allowClinicalUpdateSections),
    status: raw.status === 'archived' ? 'archived' : 'active',
  };
};

const sortTemplates = (templates: ClinicalDocumentTemplate[]): ClinicalDocumentTemplate[] =>
  [...templates].sort((left, right) => left.name.localeCompare(right.name, 'es'));

export const ClinicalDocumentTemplateRepository = {
  async listActive(
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalDocumentTemplate[]> {
    try {
      const templates = await db.getDocs<Partial<ClinicalDocumentTemplate>>(
        getClinicalDocumentTemplatesCollectionPath(hospitalId),
        {
          where: [{ field: 'status', operator: '==', value: 'active' }],
          orderBy: [{ field: 'name', direction: 'asc' }],
        }
      );

      const normalized = templates
        .map(template => normalizeTemplate(template))
        .filter((template): template is ClinicalDocumentTemplate => Boolean(template));

      return normalized.length > 0 ? sortTemplates(normalized) : sortTemplates(defaultTemplates);
    } catch (error) {
      console.error('[ClinicalDocumentTemplateRepository] Failed to list templates:', error);
      return sortTemplates(defaultTemplates);
    }
  },

  async seedDefaults(hospitalId: string = getActiveHospitalId()): Promise<void> {
    await db.runBatch(batch => {
      defaultTemplates.forEach(template => {
        batch.set(getClinicalDocumentTemplatesCollectionPath(hospitalId), template.id, template, {
          merge: true,
        });
      });
    });
  },
};
