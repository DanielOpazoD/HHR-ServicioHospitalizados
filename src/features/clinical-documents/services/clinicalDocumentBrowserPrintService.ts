import type {
  ClinicalDocumentIeehDraft,
  ClinicalDocumentType,
} from '@/features/clinical-documents/domain/entities';
import { getClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions';
import {
  CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID,
  CLINICAL_DOCUMENT_INLINE_PRINT_STYLE_ID,
  CLINICAL_DOCUMENT_SHEET_ID,
  sanitizeClinicalDocumentSheetClone,
} from '@/features/clinical-documents/services/clinicalDocumentPrintSupport';

const DOCUMENT_TYPES_WITH_PATIENT_SIGNATURE = new Set<ClinicalDocumentType>([
  'epicrisis',
  'epicrisis_traslado',
]);

/**
 * Injects a CIE-10 block after the diagnósticos section in the print clone.
 * Only called when the epicrisis has an ieehDraft with a code selected.
 */
const injectCie10PrintBlock = (
  sheetClone: HTMLElement,
  ieehDraft: ClinicalDocumentIeehDraft
): void => {
  const diagEditor = sheetClone.querySelector('[data-section-editor="diagnosticos"]');
  const container =
    diagEditor?.closest('.clinical-document-section-wrapper') ?? diagEditor?.parentElement;
  if (!container) return;

  const block = document.createElement('div');
  block.style.cssText =
    'margin-top:8px;padding:6px 10px;border:1px solid #d1d5db;border-radius:6px;background:#f0fdf4;font-size:11px;color:#15803d';
  block.innerHTML = `<strong>CIE-10:</strong> ${ieehDraft.cie10Code} — ${ieehDraft.cie10Description}`;
  container.appendChild(block);
};

export const openClinicalDocumentBrowserPrintPreview = async (
  pageTitle: string,
  documentType: ClinicalDocumentType = 'epicrisis',
  ieehDraft?: ClinicalDocumentIeehDraft
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

  // Inject CIE-10 block when printing an epicrisis with IEEH data
  if (ieehDraft?.cie10Code) {
    injectCie10PrintBlock(sheetClone, ieehDraft);
  }

  const printOptions = getClinicalDocumentDefinition(documentType).printOptions;
  const hasAnnex = sheetClone.querySelector('.clinical-document-annex-page') != null;
  const includePatientSignature =
    DOCUMENT_TYPES_WITH_PATIENT_SIGNATURE.has(documentType) && !hasAnnex;
  const printRoot = document.createElement('div');
  printRoot.id = CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID;
  printRoot.innerHTML = includePatientSignature
    ? [
        sheetClone.outerHTML,
        '<div class="clinical-document-print-signature-block" aria-hidden="true">',
        '  <div class="clinical-document-patient-signature-line"></div>',
        '  <div class="clinical-document-patient-signature-label">Firma paciente/familiar responsable</div>',
        '</div>',
      ].join('')
    : sheetClone.outerHTML;

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
