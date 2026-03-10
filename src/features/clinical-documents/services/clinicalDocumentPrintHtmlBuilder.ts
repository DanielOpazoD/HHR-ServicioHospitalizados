import type { ClinicalDocumentType } from '@/features/clinical-documents/domain/entities';
import { getClinicalDocumentDefinition } from '@/features/clinical-documents/domain/definitions';
import clinicalDocumentSheetStyles from '@/features/clinical-documents/styles/clinicalDocumentSheet.css?raw';
import {
  CLINICAL_DOCUMENT_SHEET_ID,
  escapeHtmlAttr,
  escapeHtmlText,
  escapeStyleText,
  sanitizeClinicalDocumentSheetClone,
} from '@/features/clinical-documents/services/clinicalDocumentPrintSupport';

interface PrintHtmlOptions {
  pageTitle?: string;
  hidePatientInfoTitle?: boolean;
  includeAppStyles?: boolean;
  bodyFontFamily?: string;
  documentType?: ClinicalDocumentType;
}

const collectAppStyleTags = (): string => {
  if (typeof document === 'undefined') {
    return '';
  }

  return Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');
};

const buildPageStyleRule = (documentType?: ClinicalDocumentType): string => {
  const printOptions = getClinicalDocumentDefinition(documentType || 'epicrisis').printOptions;
  return `@page { size: ${printOptions.pageSize}; margin: ${printOptions.pageMarginMm}mm; }`;
};

export const buildClinicalDocumentPrintHtml = async (
  options: PrintHtmlOptions = {}
): Promise<string | null> => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const sheet = document.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
  if (!(sheet instanceof HTMLElement)) {
    return null;
  }

  const sheetClone = sheet.cloneNode(true) as HTMLElement;
  await sanitizeClinicalDocumentSheetClone(sheet, sheetClone);

  const baseHref = escapeHtmlAttr(`${window.location.origin}/`);
  const pageTitle = escapeHtmlText(options.pageTitle?.trim() || 'Epicrisis médica');
  const printOverrides = options.hidePatientInfoTitle
    ? '.clinical-document-patient-info-title{display:none !important;}'
    : '';
  const appStyles = options.includeAppStyles ? collectAppStyleTags() : '';
  const bodyFontFamily = escapeHtmlText(
    options.bodyFontFamily?.trim() ||
      window.getComputedStyle(document.body).fontFamily ||
      "Inter, 'Segoe UI', Roboto, Arial, sans-serif"
  );

  return [
    '<!doctype html>',
    '<html lang="es">',
    '<head>',
    '<meta charset="utf-8" />',
    '<meta name="viewport" content="width=device-width, initial-scale=1" />',
    `<title>${pageTitle}</title>`,
    `<base href="${baseHref}" />`,
    appStyles,
    `<style>body{font-family:${bodyFontFamily};}</style>`,
    `<style>${escapeStyleText(clinicalDocumentSheetStyles)}${printOverrides}</style>`,
    `<style id="clinical-document-page-style">${buildPageStyleRule(options.documentType)}</style>`,
    '</head>',
    '<body class="clinical-documents-print">',
    sheetClone.outerHTML,
    '<div class="clinical-document-print-bottom-bar" aria-hidden="true">',
    '  <div class="clinical-document-print-footer-left">',
    '    <div class="clinical-document-patient-signature-line"></div>',
    '    <div class="clinical-document-patient-signature-label">Firma paciente/familiar responsable</div>',
    '  </div>',
    '</div>',
    '</body>',
    '</html>',
  ].join('');
};
