import type {
  ClinicalDocumentEpisodeContext,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';
import type { ConfirmOptions } from '@/context/uiContracts';
import { getClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions';
import { hydrateLegacyClinicalDocument as hydrateLegacyClinicalDocumentCompat } from '@/features/clinical-documents/controllers/clinicalDocumentCompatibilityController';
import { formatClinicalDocumentDateTime as formatClinicalDocumentDateTimePresentation } from '@/shared/clinical-documents/clinicalDocumentPresentation';

export const serializeClinicalDocument = (record: ClinicalDocumentRecord | null): string =>
  record ? JSON.stringify(record) : '';

export const hydrateLegacyClinicalDocument = (
  record: ClinicalDocumentRecord
): ClinicalDocumentRecord => hydrateLegacyClinicalDocumentCompat(record);

export const formatClinicalDocumentDateTime = (isoString?: string): string => {
  return formatClinicalDocumentDateTimePresentation(isoString);
};

export const getClinicalDocumentPatientFieldGridClass = (fieldId: string): string =>
  `clinical-document-patient-field stacked clinical-document-patient-field--${fieldId}`;

export const getClinicalDocumentPatientFieldLabel = (
  field: ClinicalDocumentRecord['patientFields'][number],
  documentType: ClinicalDocumentRecord['documentType']
): string => {
  const definition = getClinicalDocumentDefinition(documentType);
  return definition.resolvePatientFieldLabel?.(field) || field.label;
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

const formatPdfFileDate = (rawDate: string | undefined): string | null => {
  if (!rawDate) return null;

  const dateOnlyMatch = rawDate.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    return `${Number(day)}/${Number(month)}/${year}`;
  }

  const parsed = new Date(rawDate);
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return `${parsed.getDate()}/${parsed.getMonth() + 1}/${parsed.getFullYear()}`;
};

const resolveClinicalDocumentPdfDate = (record: ClinicalDocumentRecord): string => {
  const reportDate = record.patientFields.find(field => field.id === 'finf')?.value;
  return (
    formatPdfFileDate(reportDate) ||
    formatPdfFileDate(record.sourceDailyRecordDate) ||
    formatPdfFileDate(record.audit.updatedAt) ||
    'Sin fecha'
  );
};

const resolveClinicalDocumentPdfPatientName = (record: ClinicalDocumentRecord): string => {
  const fieldName = record.patientFields.find(field => field.id === 'nombre')?.value?.trim();
  const patientName = record.patientName.trim();
  return (fieldName || patientName || 'Paciente').replace(/\s+/g, ' ');
};

export const buildClinicalDocumentPdfFileName = (record: ClinicalDocumentRecord): string =>
  `${resolveClinicalDocumentPdfDate(record)} - ${resolveClinicalDocumentPdfPatientName(record)}.pdf`;

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
