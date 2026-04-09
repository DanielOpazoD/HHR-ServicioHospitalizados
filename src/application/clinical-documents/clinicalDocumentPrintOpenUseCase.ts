import { openClinicalDocumentBrowserPrintPreview } from '@/features/clinical-documents/services/clinicalDocumentPrintPdfService';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

export const executeOpenClinicalDocumentPrint = (
  record: ClinicalDocumentRecord
): Promise<boolean> => openClinicalDocumentBrowserPrintPreview(record.title, record.documentType);
