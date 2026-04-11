import type {
  ClinicalDocumentPatientFieldTemplate,
  ClinicalDocumentSectionTemplate,
  ClinicalDocumentTemplate,
} from '@/features/clinical-documents';
import { createTemplatePatientField, createTemplateSection } from '@/features/clinical-documents';

const patchTemplateItem = <T extends { id: string }>(
  items: T[],
  itemId: string,
  patch: Partial<T>
): T[] => items.map(item => (item.id === itemId ? { ...item, ...patch } : item));

const removeTemplateItem = <T extends { id: string }>(items: T[], itemId: string): T[] =>
  items.filter(item => item.id !== itemId);

export const patchClinicalDocumentTemplate = (
  templates: ClinicalDocumentTemplate[],
  templateId: string,
  patch: Partial<ClinicalDocumentTemplate>
): ClinicalDocumentTemplate[] =>
  templates.map(template => (template.id === templateId ? { ...template, ...patch } : template));

export const patchClinicalDocumentTemplateField = (
  templates: ClinicalDocumentTemplate[],
  templateId: string,
  fieldId: string,
  patch: Partial<ClinicalDocumentPatientFieldTemplate>
): ClinicalDocumentTemplate[] =>
  templates.map(template =>
    template.id === templateId
      ? {
          ...template,
          patientFields: patchTemplateItem(template.patientFields, fieldId, patch),
        }
      : template
  );

export const patchClinicalDocumentTemplateSection = (
  templates: ClinicalDocumentTemplate[],
  templateId: string,
  sectionId: string,
  patch: Partial<ClinicalDocumentSectionTemplate>
): ClinicalDocumentTemplate[] =>
  templates.map(template =>
    template.id === templateId
      ? {
          ...template,
          sections: patchTemplateItem(template.sections, sectionId, patch),
        }
      : template
  );

export const addClinicalDocumentTemplateField = (
  templates: ClinicalDocumentTemplate[],
  templateId: string
): ClinicalDocumentTemplate[] =>
  templates.map(template =>
    template.id === templateId
      ? {
          ...template,
          patientFields: [...template.patientFields, createTemplatePatientField()],
        }
      : template
  );

export const removeClinicalDocumentTemplateField = (
  templates: ClinicalDocumentTemplate[],
  templateId: string,
  fieldId: string
): ClinicalDocumentTemplate[] =>
  templates.map(template =>
    template.id === templateId
      ? {
          ...template,
          patientFields: removeTemplateItem(template.patientFields, fieldId),
        }
      : template
  );

export const addClinicalDocumentTemplateSection = (
  templates: ClinicalDocumentTemplate[],
  templateId: string
): ClinicalDocumentTemplate[] =>
  templates.map(template =>
    template.id === templateId
      ? {
          ...template,
          sections: [...template.sections, createTemplateSection(template.sections.length)],
        }
      : template
  );

export const removeClinicalDocumentTemplateSection = (
  templates: ClinicalDocumentTemplate[],
  templateId: string,
  sectionId: string
): ClinicalDocumentTemplate[] =>
  templates.map(template =>
    template.id === templateId
      ? {
          ...template,
          sections: removeTemplateItem(template.sections, sectionId).map((section, index) => ({
            ...section,
            order: index,
          })),
        }
      : template
  );

export const replaceSavedClinicalDocumentTemplate = (
  templates: ClinicalDocumentTemplate[],
  template: ClinicalDocumentTemplate
): ClinicalDocumentTemplate[] =>
  templates.map(current => (current.id === template.id ? template : current));
