import { db } from '@/services/infrastructure/db';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type { ClinicalDocumentTemplate } from '@/features/clinical-documents/domain/entities';
import { CLINICAL_DOCUMENT_TEMPLATES } from '@/features/clinical-documents/domain/rules';
import {
  formatClinicalDocumentContractIssues,
  parseClinicalDocumentTemplate,
  safeParseClinicalDocumentTemplate,
} from '@/features/clinical-documents/contracts/clinicalDocumentRuntimeContracts';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';

const getClinicalDocumentTemplatesCollectionPath = (
  hospitalId: string = getActiveHospitalId()
): string => `hospitals/${hospitalId}/clinicalDocumentTemplates`;

const defaultTemplates = Object.values(CLINICAL_DOCUMENT_TEMPLATES);

const normalizeEpicrisisTemplate = (
  template: ClinicalDocumentTemplate
): ClinicalDocumentTemplate => {
  if (template.documentType !== 'epicrisis') {
    return template;
  }

  const patientFields = template.patientFields.map(field =>
    field.id === 'finf' ? { ...field, label: 'Fecha de alta' } : field
  );

  const sectionById = new Map(template.sections.map(section => [section.id, section]));
  const antecedentes = sectionById.get('antecedentes');
  const historia = sectionById.get('historia-evolucion');
  const diagnosticos = sectionById.get('diagnosticos');
  const plan = sectionById.get('plan');
  const examenes = sectionById.get('examenes-complementarios');

  const sections = [
    antecedentes
      ? { ...antecedentes, order: 0, title: antecedentes.title || 'Antecedentes' }
      : null,
    historia
      ? {
          ...historia,
          order: 1,
          title: historia.title || 'Historia y evolución clínica',
        }
      : null,
    diagnosticos
      ? {
          ...diagnosticos,
          order: 2,
          title:
            diagnosticos.title === 'Diagnósticos' || !diagnosticos.title
              ? 'Diagnósticos de egreso'
              : diagnosticos.title,
          visible: true,
        }
      : {
          id: 'diagnosticos',
          title: 'Diagnósticos de egreso',
          order: 2,
          required: false,
          visible: true,
        },
    plan
      ? {
          ...plan,
          order: 3,
          title: plan.title === 'Plan' || !plan.title ? 'Indicaciones al alta' : plan.title,
        }
      : null,
    examenes ? { ...examenes, order: 4 } : null,
  ].filter(Boolean) as ClinicalDocumentTemplate['sections'];

  return {
    ...template,
    patientFields,
    sections,
  };
};

const normalizeTemplate = (
  raw: Partial<ClinicalDocumentTemplate> | null | undefined
): ClinicalDocumentTemplate | null => {
  if (!raw?.id || !raw.documentType || !raw.name || !raw.title || typeof raw.version !== 'number') {
    return null;
  }

  const normalizedTemplate: ClinicalDocumentTemplate = {
    id: raw.id,
    documentType: raw.documentType,
    name: raw.name,
    title: raw.title,
    defaultPatientInfoTitle:
      typeof raw.defaultPatientInfoTitle === 'string' && raw.defaultPatientInfoTitle.trim()
        ? raw.defaultPatientInfoTitle
        : 'Información del Paciente',
    defaultFooterMedicoLabel:
      typeof raw.defaultFooterMedicoLabel === 'string' && raw.defaultFooterMedicoLabel.trim()
        ? raw.defaultFooterMedicoLabel
        : 'Médico',
    defaultFooterEspecialidadLabel:
      typeof raw.defaultFooterEspecialidadLabel === 'string' &&
      raw.defaultFooterEspecialidadLabel.trim()
        ? raw.defaultFooterEspecialidadLabel
        : 'Especialidad',
    version: raw.version,
    patientFields: Array.isArray(raw.patientFields) ? raw.patientFields : [],
    sections: Array.isArray(raw.sections) ? raw.sections : [],
    allowCustomTitle: Boolean(raw.allowCustomTitle),
    allowAddSection: Boolean(raw.allowAddSection),
    allowClinicalUpdateSections: Boolean(raw.allowClinicalUpdateSections),
    status: raw.status === 'archived' ? 'archived' : 'active',
  };

  return normalizeEpicrisisTemplate(normalizedTemplate);
};

const sortTemplates = (templates: ClinicalDocumentTemplate[]): ClinicalDocumentTemplate[] =>
  [...templates].sort((left, right) => left.name.localeCompare(right.name, 'es'));

const validateTemplate = (template: ClinicalDocumentTemplate): ClinicalDocumentTemplate | null => {
  const parsed = safeParseClinicalDocumentTemplate(template);
  if (!parsed.success) {
    recordOperationalTelemetry({
      category: 'clinical_document',
      status: 'failed',
      operation: 'clinical_document_template_repository_invalid_template',
      issues: formatClinicalDocumentContractIssues(parsed.error.issues),
      context: { templateId: template.id, documentType: template.documentType },
    });
    return null;
  }

  return parsed.data;
};

export const ClinicalDocumentTemplateRepository = {
  async listAll(hospitalId: string = getActiveHospitalId()): Promise<ClinicalDocumentTemplate[]> {
    try {
      const templates = await db.getDocs<Partial<ClinicalDocumentTemplate>>(
        getClinicalDocumentTemplatesCollectionPath(hospitalId),
        {
          orderBy: [{ field: 'name', direction: 'asc' }],
        }
      );

      const normalized = templates
        .map(template => normalizeTemplate(template))
        .filter((template): template is ClinicalDocumentTemplate => Boolean(template))
        .map(template => validateTemplate(template))
        .filter((template): template is ClinicalDocumentTemplate => Boolean(template));

      return normalized.length > 0 ? sortTemplates(normalized) : sortTemplates(defaultTemplates);
    } catch (error) {
      recordOperationalTelemetry({
        category: 'clinical_document',
        status: 'failed',
        operation: 'clinical_document_template_repository_list_all',
        issues: [error instanceof Error ? error.message : 'No se pudieron listar templates'],
        context: { hospitalId },
      });
      return sortTemplates(defaultTemplates);
    }
  },

  async listActive(
    hospitalId: string = getActiveHospitalId()
  ): Promise<ClinicalDocumentTemplate[]> {
    try {
      const templates = await db.getDocs<Partial<ClinicalDocumentTemplate>>(
        getClinicalDocumentTemplatesCollectionPath(hospitalId),
        {
          where: [{ field: 'status', operator: '==', value: 'active' }],
        }
      );

      const normalized = templates
        .map(template => normalizeTemplate(template))
        .filter((template): template is ClinicalDocumentTemplate => Boolean(template))
        .map(template => validateTemplate(template))
        .filter((template): template is ClinicalDocumentTemplate => Boolean(template));

      return normalized.length > 0 ? sortTemplates(normalized) : sortTemplates(defaultTemplates);
    } catch (error) {
      recordOperationalTelemetry({
        category: 'clinical_document',
        status: 'failed',
        operation: 'clinical_document_template_repository_list_active',
        issues: [error instanceof Error ? error.message : 'No se pudieron listar templates'],
        context: { hospitalId },
      });
      return sortTemplates(defaultTemplates);
    }
  },

  async seedDefaults(hospitalId: string = getActiveHospitalId()): Promise<void> {
    await db.runBatch(batch => {
      defaultTemplates.forEach(template => {
        batch.set(
          getClinicalDocumentTemplatesCollectionPath(hospitalId),
          template.id,
          parseClinicalDocumentTemplate(template),
          {
            merge: true,
          }
        );
      });
    });
  },

  async save(
    template: ClinicalDocumentTemplate,
    hospitalId: string = getActiveHospitalId()
  ): Promise<void> {
    await db.setDoc(
      getClinicalDocumentTemplatesCollectionPath(hospitalId),
      template.id,
      parseClinicalDocumentTemplate(template),
      {
        merge: true,
      }
    );
  },
};
