import {
  openClinicalDocumentBrowserPrintPreview,
  type ClinicalDocumentRecord,
} from '@/features/clinical-documents/internal';

export const executeOpenClinicalDocumentPrint = (
  record: ClinicalDocumentRecord
): Promise<boolean> => openClinicalDocumentBrowserPrintPreview(record.title, record.documentType);
