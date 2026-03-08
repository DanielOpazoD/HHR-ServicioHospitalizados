import type {
  ClinicalDocumentEpisodeContext,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';
import type { ConfirmOptions } from '@/context/uiContracts';

export const serializeClinicalDocument = (record: ClinicalDocumentRecord | null): string =>
  record ? JSON.stringify(record) : '';

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

export const hydrateLegacyClinicalDocument = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => {
  const normalizedSections =
    record.documentType === 'epicrisis'
      ? normalizeEpicrisisSections(record.sections)
      : record.sections;

  return {
    ...record,
    sections: normalizedSections,
    patientInfoTitle: record.patientInfoTitle || 'Información del Paciente',
    footerMedicoLabel: record.footerMedicoLabel || 'Médico',
    footerEspecialidadLabel: record.footerEspecialidadLabel || 'Especialidad',
  };
};

export const formatClinicalDocumentDateTime = (isoString?: string): string => {
  if (!isoString) return '—';
  const value = new Date(isoString);
  return Number.isNaN(value.getTime())
    ? isoString
    : value.toLocaleString('es-CL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
};

export const getClinicalDocumentPatientFieldGridClass = (fieldId: string): string =>
  `clinical-document-patient-field stacked clinical-document-patient-field--${fieldId}`;

export const getClinicalDocumentPatientFieldLabel = (
  field: ClinicalDocumentRecord['patientFields'][number],
  documentType: ClinicalDocumentRecord['documentType']
): string => {
  if (
    documentType === 'epicrisis' &&
    field.id === 'finf' &&
    (!field.label || field.label === 'Fecha del informe')
  ) {
    return 'Fecha de alta';
  }
  return field.label;
};

export const resizeClinicalDocumentSectionTextarea = (
  textarea: HTMLTextAreaElement | null
): void => {
  if (!textarea) return;
  textarea.style.height = 'auto';
  const minHeight = 92;
  textarea.style.height = `${Math.max(textarea.scrollHeight, minHeight)}px`;
};

export const buildClinicalDocumentActor = (
  user: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  } | null,
  role: string | null | undefined
) => ({
  uid: user?.uid || '',
  email: user?.email || '',
  displayName: user?.displayName || user?.email || 'Usuario',
  role: role || 'viewer',
});

export const buildClinicalDocumentPdfFileName = (record: ClinicalDocumentRecord): string =>
  `${record.title.replace(/\s+/g, '_')}_${record.patientRut.replace(/[.-]/g, '')}_${record.episodeKey}.pdf`;

export const buildClinicalDocumentWorkspaceNotifyPort = (
  success: (title: string, message?: string) => void,
  warning: (title: string, message?: string) => void,
  notifyError: (title: string, message?: string) => void,
  info: (title: string, message?: string) => void,
  confirm: (options: ConfirmOptions) => Promise<boolean>
) => ({
  success,
  warning,
  error: notifyError,
  info,
  confirm,
});

export type ClinicalDocumentWorkspaceEpisode = ClinicalDocumentEpisodeContext;
