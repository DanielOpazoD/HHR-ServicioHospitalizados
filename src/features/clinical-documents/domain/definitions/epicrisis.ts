import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import {
  createBaseClinicalDocumentDefinition,
  type ClinicalDocumentDefinition,
} from '@/features/clinical-documents/domain/definitions/base';

const normalizeEpicrisisSections = (
  sections: ClinicalDocumentRecord['sections']
): ClinicalDocumentRecord['sections'] => {
  const templateDefaults: Record<
    string,
    Pick<ClinicalDocumentRecord['sections'][number], 'title' | 'required' | 'visible'> & {
      order: number;
    }
  > = {
    antecedentes: { title: 'Antecedentes', order: 0, required: true, visible: true },
    'historia-evolucion': {
      title: 'Historia y evolución clínica',
      order: 1,
      required: true,
      visible: true,
    },
    'examenes-complementarios': {
      title: 'Exámenes complementarios',
      order: 2,
      required: false,
      visible: false,
    },
    diagnosticos: {
      title: 'Diagnósticos de egreso',
      order: 3,
      required: false,
      visible: true,
    },
    plan: {
      title: 'Indicaciones al alta',
      order: 4,
      required: true,
      visible: true,
    },
  };

  const seen = new Set<string>();
  const normalizedSections = sections.map(section => {
    seen.add(section.id);
    const defaults = templateDefaults[section.id];
    if (!defaults) {
      return {
        ...section,
        order: section.order ?? Number.MAX_SAFE_INTEGER,
      };
    }

    const normalizedTitle =
      section.id === 'diagnosticos' && (!section.title || section.title === 'Diagnósticos')
        ? defaults.title
        : section.id === 'plan' && (!section.title || section.title === 'Plan')
          ? defaults.title
          : section.title || defaults.title;

    return {
      ...section,
      title: normalizedTitle,
      required: section.required ?? defaults.required,
      visible: section.visible ?? defaults.visible,
      order: section.order ?? defaults.order,
    };
  });

  Object.entries(templateDefaults).forEach(([sectionId, defaults]) => {
    if (seen.has(sectionId)) return;
    normalizedSections.push({
      id: sectionId,
      title: defaults.title,
      content: '',
      order: defaults.order,
      required: defaults.required,
      visible: defaults.visible,
    });
  });

  return normalizedSections
    .sort((left, right) => {
      if (left.order !== right.order) return left.order - right.order;
      return (
        (templateDefaults[left.id]?.order ?? Number.MAX_SAFE_INTEGER) -
        (templateDefaults[right.id]?.order ?? Number.MAX_SAFE_INTEGER)
      );
    })
    .map((section, index) => ({
      ...section,
      order: index,
    }));
};

export const EPICRISIS_CLINICAL_DOCUMENT_DEFINITION: ClinicalDocumentDefinition = {
  ...createBaseClinicalDocumentDefinition('epicrisis'),
  sectionRenderers: {
    plan: 'plan_subsections',
  },
  sectionNormalizers: [normalizeEpicrisisSections],
  resolvePatientFieldLabel: field =>
    field.id === 'finf' && (!field.label || field.label === 'Fecha del informe')
      ? 'Fecha de alta'
      : null,
};
