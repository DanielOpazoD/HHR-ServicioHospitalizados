import { httpsCallable } from 'firebase/functions';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { getFunctionsInstance } from '@/firebaseConfig';
import clinicalDocumentSheetStyles from '@/features/clinical-documents/styles/clinicalDocumentSheet.css?raw';

const CLINICAL_DOCUMENT_SHEET_ID = 'clinical-document-sheet';

interface RenderClinicalDocumentPdfPayload {
  html: string;
}

interface RenderClinicalDocumentPdfResult {
  contentBase64: string;
  mimeType: string;
}

const ASSET_LOAD_TIMEOUT_MS = 4_000;
const MM_TO_PX = 96 / 25.4;
const LETTER_PAGE_HEIGHT_MM = 279.4;
const PRINT_MARGIN_MM = 8;
const PRINT_USABLE_HEIGHT_PX = (LETTER_PAGE_HEIGHT_MM - PRINT_MARGIN_MM * 2) * MM_TO_PX;

interface PrintHtmlOptions {
  pageTitle?: string;
  autoPrint?: boolean;
  closeAfterPrint?: boolean;
  hidePatientInfoTitle?: boolean;
  includeAppStyles?: boolean;
  bodyFontFamily?: string;
}

const escapeHtmlAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

const escapeStyleText = (value: string): string => value.replace(/<\/style/gi, '<\\/style');

const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const buildPrintScript = (closeAfterPrint: boolean): string =>
  [
    '<script>',
    "window.addEventListener('load', function () {",
    '  window.setTimeout(function () {',
    '    window.focus();',
    '    window.print();',
    '  }, 100);',
    '});',
    closeAfterPrint
      ? "window.addEventListener('afterprint', function () { window.close(); });"
      : '',
    '</script>',
  ].join('');

const collectAppStyleTags = (): string => {
  if (typeof document === 'undefined') {
    return '';
  }

  return Array.from(document.head.querySelectorAll('link[rel="stylesheet"], style'))
    .map(node => node.outerHTML)
    .join('\n');
};

const buildPrintHtml = (options: PrintHtmlOptions = {}): string | null => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const sheet = document.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
  if (!sheet) {
    return null;
  }

  const sheetClone = sheet.cloneNode(true) as HTMLElement;
  sheetClone.removeAttribute('contenteditable');
  sheetClone
    .querySelectorAll('[contenteditable]')
    .forEach(node => node.removeAttribute('contenteditable'));
  sheetClone.querySelectorAll('input, textarea').forEach(node => {
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.readOnly = true;
    }
  });

  const baseHref = escapeHtmlAttr(`${window.location.origin}/`);
  const pageTitle = escapeHtmlText(options.pageTitle?.trim() || 'Epicrisis médica');
  const printOverrides = options.hidePatientInfoTitle
    ? '.clinical-document-patient-info-title{display:none !important;}'
    : '';
  const printScript = options.autoPrint ? buildPrintScript(Boolean(options.closeAfterPrint)) : '';
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
    '</head>',
    '<body class="clinical-documents-print">',
    sheetClone.outerHTML,
    '<div class="clinical-document-print-bottom-bar" aria-hidden="true">',
    '  <div class="clinical-document-print-footer-left">',
    '    <div class="clinical-document-patient-signature-line"></div>',
    '    <div class="clinical-document-patient-signature-label">Firma paciente/familiar responsable</div>',
    '  </div>',
    '  <div class="clinical-document-print-footer-right">1/1</div>',
    '</div>',
    printScript,
    '</body>',
    '</html>',
  ].join('');
};

const decodeBase64Pdf = (contentBase64: string, mimeType: string): Blob => {
  const clean = contentBase64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType || 'application/pdf' });
};

const waitForImageReady = async (image: HTMLImageElement, ownerWindow: Window): Promise<void> => {
  if (image.complete && image.naturalWidth > 0) {
    return;
  }

  await new Promise<void>(resolve => {
    const onDone = () => {
      image.removeEventListener('load', onDone);
      image.removeEventListener('error', onDone);
      resolve();
    };

    image.addEventListener('load', onDone);
    image.addEventListener('error', onDone);
    ownerWindow.setTimeout(onDone, ASSET_LOAD_TIMEOUT_MS);
  });
};

const waitForSheetAssets = async (
  sheet: HTMLElement,
  ownerDocument: Document,
  ownerWindow: Window
): Promise<void> => {
  const images = Array.from(sheet.querySelectorAll('img'));
  await Promise.all(images.map(image => waitForImageReady(image, ownerWindow)));

  if ('fonts' in ownerDocument) {
    try {
      const fontReady = (ownerDocument as Document & { fonts?: FontFaceSet }).fonts?.ready;
      if (fontReady) {
        await Promise.race([
          fontReady,
          new Promise(resolve => ownerWindow.setTimeout(resolve, ASSET_LOAD_TIMEOUT_MS)),
        ]);
      }
    } catch {
      // Best effort: font readiness should not block PDF generation.
    }
  }
};

const updatePrintFooterPageCounter = (ownerDocument: Document): void => {
  const sheet = ownerDocument.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
  const counter = ownerDocument.querySelector('.clinical-document-print-footer-right');
  if (!(sheet instanceof HTMLElement) || !(counter instanceof HTMLElement)) {
    return;
  }

  const estimatedTotalPages = Math.max(1, Math.ceil(sheet.scrollHeight / PRINT_USABLE_HEIGHT_PX));
  counter.textContent = `1/${estimatedTotalPages}`;
};

const createIsolatedPrintFrame = async (
  html: string
): Promise<{
  sheet: HTMLElement;
  frameWindow: Window;
  frameDocument: Document;
  cleanup: () => void;
}> => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    throw new Error('Browser environment required for snapshot PDF generation.');
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '1200px';
  iframe.style.height = '2000px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  const cleanup = () => {
    iframe.remove();
  };

  try {
    const frameDocument = iframe.contentDocument;
    const frameWindow = iframe.contentWindow;
    if (!frameDocument || !frameWindow) {
      cleanup();
      throw new Error('No se pudo crear el documento aislado para PDF.');
    }

    frameDocument.open();
    frameDocument.write(html);
    frameDocument.close();

    await new Promise<void>(resolve => {
      if (frameDocument.readyState === 'complete') {
        resolve();
        return;
      }
      frameWindow.addEventListener('load', () => resolve(), { once: true });
      frameWindow.setTimeout(() => resolve(), ASSET_LOAD_TIMEOUT_MS);
    });

    const sheet = frameDocument.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
    if (!sheet) {
      cleanup();
      throw new Error('No se encontró la hoja clínica en el frame de impresión.');
    }

    return {
      sheet,
      frameWindow,
      frameDocument,
      cleanup,
    };
  } catch (error) {
    cleanup();
    throw error;
  }
};

const generateDomSnapshotPdfBlob = async (html: string): Promise<Blob> => {
  const isolated = await createIsolatedPrintFrame(html);

  try {
    await waitForSheetAssets(isolated.sheet, isolated.frameDocument, isolated.frameWindow);

    const canvas = await html2canvas(isolated.sheet, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      allowTaint: false,
      logging: false,
    });

    const imageData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter',
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imageWidth = pageWidth;
    const imageHeight = (canvas.height * imageWidth) / canvas.width;

    let remainingHeight = imageHeight;
    let positionY = 0;

    pdf.addImage(imageData, 'PNG', 0, positionY, imageWidth, imageHeight, undefined, 'FAST');
    remainingHeight -= pageHeight;

    while (remainingHeight > 0) {
      positionY = remainingHeight - imageHeight;
      pdf.addPage();
      pdf.addImage(imageData, 'PNG', 0, positionY, imageWidth, imageHeight, undefined, 'FAST');
      remainingHeight -= pageHeight;
    }

    return pdf.output('blob');
  } finally {
    isolated.cleanup();
  }
};

const generateBackendPrintStyledPdfBlob = async (html: string): Promise<Blob> => {
  const functions = await getFunctionsInstance();
  const callable = httpsCallable<RenderClinicalDocumentPdfPayload, RenderClinicalDocumentPdfResult>(
    functions,
    'renderClinicalDocumentPdfFromHtml'
  );

  const response = await callable({ html });
  const contentBase64 = response.data?.contentBase64;
  const mimeType = response.data?.mimeType || 'application/pdf';

  if (!contentBase64) {
    throw new Error('No se recibió contenido PDF desde el render backend.');
  }

  return decodeBase64Pdf(contentBase64, mimeType);
};

export const generateClinicalDocumentPrintStyledPdfBlob = async (): Promise<Blob | null> => {
  const html = buildPrintHtml();
  if (!html) {
    return null;
  }

  try {
    return await generateDomSnapshotPdfBlob(html);
  } catch (error) {
    console.warn(
      '[clinicalDocumentPrintPdfService] client snapshot failed, falling back to backend render:',
      error
    );
  }

  try {
    return await generateBackendPrintStyledPdfBlob(html);
  } catch (error) {
    console.warn('[clinicalDocumentPrintPdfService] backend render failed:', error);
    return null;
  }
};

export const openClinicalDocumentBrowserPrintPreview = (pageTitle: string): boolean => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const html = buildPrintHtml({
    pageTitle,
    autoPrint: false,
    hidePatientInfoTitle: false,
    includeAppStyles: true,
  });
  if (!html) {
    return false;
  }

  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = '1200px';
  iframe.style.height = '1800px';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const frameDocument = iframe.contentDocument;
  const frameWindow = iframe.contentWindow;
  if (!frameDocument || !frameWindow) {
    iframe.remove();
    return false;
  }

  frameDocument.open();
  frameDocument.write(html);
  frameDocument.close();

  updatePrintFooterPageCounter(frameDocument);

  let printed = false;
  const cleanup = () => {
    frameWindow.removeEventListener('afterprint', cleanup);
    iframe.remove();
  };

  const triggerPrint = () => {
    if (printed) return;
    printed = true;
    updatePrintFooterPageCounter(frameDocument);
    frameWindow.addEventListener('afterprint', cleanup, { once: true });
    window.setTimeout(cleanup, 60_000);
    frameWindow.focus();
    frameWindow.print();
  };

  if (frameDocument.readyState === 'complete') {
    window.setTimeout(triggerPrint, 100);
  } else {
    frameWindow.addEventListener('load', () => window.setTimeout(triggerPrint, 100), {
      once: true,
    });
    window.setTimeout(triggerPrint, 1_500);
  }

  return true;
};
