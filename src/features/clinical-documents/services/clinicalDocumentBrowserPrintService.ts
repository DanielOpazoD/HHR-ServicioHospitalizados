import type { ClinicalDocumentType } from '@/features/clinical-documents/domain/entities';
import { getClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions';
import {
  CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID,
  CLINICAL_DOCUMENT_INLINE_PRINT_STYLE_ID,
  CLINICAL_DOCUMENT_SHEET_ID,
  sanitizeClinicalDocumentSheetClone,
} from '@/features/clinical-documents/services/clinicalDocumentPrintSupport';

export const openClinicalDocumentBrowserPrintPreview = async (
  pageTitle: string,
  documentType: ClinicalDocumentType = 'epicrisis'
): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const sheet = document.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
  if (!(sheet instanceof HTMLElement)) {
    return false;
  }

  document.getElementById(CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID)?.remove();
  document.getElementById(CLINICAL_DOCUMENT_INLINE_PRINT_STYLE_ID)?.remove();

  const sheetClone = sheet.cloneNode(true) as HTMLElement;
  await sanitizeClinicalDocumentSheetClone(sheet, sheetClone);

  const printOptions = getClinicalDocumentDefinition(documentType).printOptions;
  const printRoot = document.createElement('div');
  printRoot.id = CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID;
  printRoot.innerHTML = [
    sheetClone.outerHTML,
    '<div class="clinical-document-print-signature-block" aria-hidden="true">',
    '  <div class="clinical-document-patient-signature-line"></div>',
    '  <div class="clinical-document-patient-signature-label">Firma paciente/familiar responsable</div>',
    '</div>',
  ].join('');

  const printStyle = document.createElement('style');
  printStyle.id = CLINICAL_DOCUMENT_INLINE_PRINT_STYLE_ID;
  printStyle.textContent = `@page { size: ${printOptions.pageSize}; margin: ${printOptions.pageMarginMm}mm; }`;

  const originalTitle = document.title;
  document.title = pageTitle || originalTitle;
  document.head.appendChild(printStyle);
  document.body.appendChild(printRoot);
  document.body.classList.add('clinical-document-inline-print-mode');

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    document.body.classList.remove('clinical-document-inline-print-mode');
    printRoot.remove();
    printStyle.remove();
    document.title = originalTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(cleanup, 60_000);
  window.setTimeout(() => {
    window.print();
  }, 100);

  return true;
};
