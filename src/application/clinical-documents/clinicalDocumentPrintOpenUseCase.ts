import {
  openClinicalDocumentBrowserPrintPreview,
  type ClinicalDocumentRecord,
} from '@/features/clinical-documents/internal';
import type { ClinicalDocumentAnnexPrintMode } from '@/features/clinical-documents/services/clinicalDocumentPrintSupport';

export const executeOpenClinicalDocumentPrint = (
  record: ClinicalDocumentRecord,
  options: { annexMode?: ClinicalDocumentAnnexPrintMode } = {}
): Promise<boolean> =>
  openClinicalDocumentBrowserPrintPreview(record.title, record.documentType, record.ieehDraft, {
    annexMode: options.annexMode,
  });
