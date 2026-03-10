import { httpsCallable } from 'firebase/functions';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import { getFunctionsInstance } from '@/firebaseConfig';
import { CLINICAL_DOCUMENT_BRANDING } from '@/features/clinical-documents/domain/branding';
import clinicalDocumentSheetStyles from '@/features/clinical-documents/styles/clinicalDocumentSheet.css?raw';

const CLINICAL_DOCUMENT_SHEET_ID = 'clinical-document-sheet';
const CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID = 'clinical-document-inline-print-root';
const CLINICAL_DOCUMENT_INLINE_PRINT_STYLE_ID = 'clinical-document-inline-print-style';
const CLINICAL_DOCUMENT_INLINE_PRINT_MEASURE_ID = 'clinical-document-inline-print-measure';
const MM_TO_PX = 96 / 25.4;
const LETTER_PAGE_HEIGHT_MM = 279.4;
const PRINT_MARGIN_MM = 8;
const PRINT_USABLE_HEIGHT_PX = (LETTER_PAGE_HEIGHT_MM - PRINT_MARGIN_MM * 2) * MM_TO_PX;
const PRINT_FOOTER_RESERVE_PX = 72;
const PRINT_SECTION_HEIGHT_BUFFER_PX = 36;

interface RenderClinicalDocumentPdfPayload {
  html: string;
}

interface RenderClinicalDocumentPdfResult {
  contentBase64: string;
  mimeType: string;
}

const ASSET_LOAD_TIMEOUT_MS = 4_000;
interface PrintHtmlOptions {
  pageTitle?: string;
  autoPrint?: boolean;
  closeAfterPrint?: boolean;
  hidePatientInfoTitle?: boolean;
  includeAppStyles?: boolean;
  bodyFontFamily?: string;
}

const readBlobAsDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(blob);
  });

const cloneImageAsDataUrl = async (image: HTMLImageElement): Promise<string | null> => {
  const source = image.currentSrc || image.src;
  if (!source) return null;
  if (source.startsWith('data:')) return source;

  if (image.complete && image.naturalWidth > 0) {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d');
      if (!context) return null;
      context.drawImage(image, 0, 0);
      return canvas.toDataURL('image/png');
    } catch {
      // Fall through to fetch-based inlining.
    }
  }

  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await readBlobAsDataUrl(blob);
  } catch {
    return null;
  }
};

const fetchAssetAsDataUrl = async (source: string): Promise<string | null> => {
  if (!source) return null;
  if (source.startsWith('data:')) return source;

  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const blob = await response.blob();
    return await readBlobAsDataUrl(blob);
  } catch {
    return null;
  }
};

const inlineSheetImages = async (originalSheet: HTMLElement, sheetClone: HTMLElement) => {
  const originalImages = Array.from(originalSheet.querySelectorAll('img'));
  const clonedImages = Array.from(sheetClone.querySelectorAll('img'));

  await Promise.all(
    clonedImages.map(async (clonedImage, index) => {
      const originalImage = originalImages[index];
      if (
        !(clonedImage instanceof HTMLImageElement) ||
        !(originalImage instanceof HTMLImageElement)
      ) {
        return;
      }

      const dataUrl = await cloneImageAsDataUrl(originalImage);
      if (dataUrl) {
        clonedImage.src = dataUrl;
      }
    })
  );
};

const inlineBrandingImages = async (sheetClone: HTMLElement) => {
  const [leftLogoDataUrl, rightLogoDataUrl] = await Promise.all([
    fetchAssetAsDataUrl(CLINICAL_DOCUMENT_BRANDING.leftLogoUrl),
    fetchAssetAsDataUrl(CLINICAL_DOCUMENT_BRANDING.rightLogoUrl),
  ]);

  const leftLogo = sheetClone.querySelector(
    'img[alt="Logo institucional izquierdo"]'
  ) as HTMLImageElement | null;
  const rightLogo = sheetClone.querySelector(
    'img[alt="Logo institucional derecho"]'
  ) as HTMLImageElement | null;

  if (leftLogoDataUrl && leftLogo) {
    leftLogo.src = leftLogoDataUrl;
  }
  if (rightLogoDataUrl && rightLogo) {
    rightLogo.src = rightLogoDataUrl;
  }
};

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

const sanitizeSheetClone = async (
  originalSheet: HTMLElement,
  sheetClone: HTMLElement
): Promise<void> => {
  await inlineSheetImages(originalSheet, sheetClone);
  await inlineBrandingImages(sheetClone);
  sheetClone.removeAttribute('contenteditable');
  sheetClone
    .querySelectorAll('[contenteditable]')
    .forEach(node => node.removeAttribute('contenteditable'));
  sheetClone
    .querySelectorAll(
      '.clinical-document-restore-panel, .clinical-document-inline-action, .clinical-document-section-drag-handle'
    )
    .forEach(node => node.remove());
  sheetClone.querySelectorAll('input, textarea').forEach(node => {
    if (node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement) {
      node.readOnly = true;
    }
  });
};

export const buildClinicalDocumentPrintHtml = async (
  options: PrintHtmlOptions = {}
): Promise<string | null> => {
  if (typeof document === 'undefined' || typeof window === 'undefined') {
    return null;
  }

  const sheet = document.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
  if (!sheet) {
    return null;
  }

  const sheetClone = sheet.cloneNode(true) as HTMLElement;
  await sanitizeSheetClone(sheet, sheetClone);

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
    '<style id="clinical-document-page-style">@page { size: letter; margin: 8mm; }</style>',
    '</head>',
    '<body class="clinical-documents-print">',
    sheetClone.outerHTML,
    '<div class="clinical-document-print-bottom-bar" aria-hidden="true">',
    '  <div class="clinical-document-print-footer-left">',
    '    <div class="clinical-document-patient-signature-line"></div>',
    '    <div class="clinical-document-patient-signature-label">Firma paciente/familiar responsable</div>',
    '  </div>',
    '</div>',
    '<div class="clinical-document-print-page-markers" aria-hidden="true"></div>',
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

const createInlinePrintMeasureSheet = async (
  sheetClone: HTMLElement
): Promise<HTMLElement | null> => {
  if (typeof document === 'undefined') {
    return null;
  }

  const existingMeasureRoot = document.getElementById(CLINICAL_DOCUMENT_INLINE_PRINT_MEASURE_ID);
  if (existingMeasureRoot) {
    existingMeasureRoot.remove();
  }

  const measureRoot = document.createElement('div');
  measureRoot.id = CLINICAL_DOCUMENT_INLINE_PRINT_MEASURE_ID;
  measureRoot.style.position = 'fixed';
  measureRoot.style.left = '-99999px';
  measureRoot.style.top = '0';
  measureRoot.style.width = `${(215.9 - PRINT_MARGIN_MM * 2) * MM_TO_PX}px`;
  measureRoot.style.visibility = 'hidden';
  measureRoot.style.pointerEvents = 'none';
  measureRoot.style.zIndex = '-1';

  const measureSheet = sheetClone.cloneNode(true) as HTMLElement;
  measureSheet.style.maxWidth = 'none';
  measureSheet.style.width = '100%';
  measureSheet.style.border = 'none';
  measureSheet.style.borderRadius = '0';
  measureSheet.style.boxShadow = 'none';
  measureSheet.style.padding = '8mm 8mm 12mm';

  measureRoot.appendChild(measureSheet);
  document.body.appendChild(measureRoot);
  await waitForSheetAssets(measureSheet, document, window);

  return measureSheet;
};

const measurePrintableSheetBlockHeights = async (
  sheetClone: HTMLElement,
  blocks: PrintableSheetBlock[]
): Promise<number[]> => {
  if (typeof document === 'undefined') {
    return blocks.map(block => block.element.scrollHeight || 0);
  }

  const existingMeasureRoot = document.getElementById(CLINICAL_DOCUMENT_INLINE_PRINT_MEASURE_ID);
  if (existingMeasureRoot) {
    existingMeasureRoot.remove();
  }

  const measureRoot = document.createElement('div');
  measureRoot.id = CLINICAL_DOCUMENT_INLINE_PRINT_MEASURE_ID;
  measureRoot.style.position = 'fixed';
  measureRoot.style.left = '-99999px';
  measureRoot.style.top = '0';
  measureRoot.style.width = `${(215.9 - PRINT_MARGIN_MM * 2) * MM_TO_PX}px`;
  measureRoot.style.visibility = 'hidden';
  measureRoot.style.pointerEvents = 'none';
  measureRoot.style.zIndex = '-1';
  document.body.appendChild(measureRoot);

  const heights: number[] = [];
  for (const block of blocks) {
    const measureSheet = sheetClone.cloneNode(false) as HTMLElement;
    measureSheet.innerHTML = '';
    measureSheet.style.maxWidth = 'none';
    measureSheet.style.width = '100%';
    measureSheet.style.border = 'none';
    measureSheet.style.borderRadius = '0';
    measureSheet.style.boxShadow = 'none';
    measureSheet.style.padding = '8mm 8mm 12mm';

    if (block.kind === 'section') {
      const wrapper = document.createElement('div');
      wrapper.className = 'space-y-3';
      wrapper.appendChild(block.element.cloneNode(true));
      measureSheet.appendChild(wrapper);
    } else {
      measureSheet.appendChild(block.element.cloneNode(true));
    }

    measureRoot.appendChild(measureSheet);
    await waitForSheetAssets(measureSheet, document, window);
    heights.push(measureSheet.scrollHeight);
    measureSheet.remove();
  }

  measureRoot.remove();
  return heights;
};

interface PrintableSheetBlock {
  kind: 'single' | 'section' | 'document_footer';
  element: HTMLElement;
  groupId?: string;
}

interface PaginatedPrintPage {
  sheetHtml: string;
  pageNumber: number;
  totalPages: number;
  isLastPage: boolean;
}

const explodePrintableSectionBlock = (
  sectionChild: HTMLElement,
  sectionIndex: number
): PrintableSheetBlock[] => {
  const sectionGroupId = `section-${sectionIndex}`;
  const subsectionContainer = sectionChild.querySelector('.clinical-document-plan-subsections');

  if (!(subsectionContainer instanceof HTMLElement)) {
    return [
      {
        kind: 'section',
        element: sectionChild.cloneNode(true) as HTMLElement,
        groupId: sectionGroupId,
      },
    ];
  }

  const subsectionNodes = Array.from(subsectionContainer.children).filter(
    child =>
      child instanceof HTMLElement && child.classList.contains('clinical-document-plan-subsection')
  ) as HTMLElement[];

  if (subsectionNodes.length === 0) {
    return [
      {
        kind: 'section',
        element: sectionChild.cloneNode(true) as HTMLElement,
        groupId: sectionGroupId,
      },
    ];
  }

  return subsectionNodes.map(subsectionNode => {
    const partialSection = sectionChild.cloneNode(true) as HTMLElement;
    const partialSubsectionContainer = partialSection.querySelector(
      '.clinical-document-plan-subsections'
    );
    if (partialSubsectionContainer instanceof HTMLElement) {
      partialSubsectionContainer.innerHTML = '';
      partialSubsectionContainer.appendChild(subsectionNode.cloneNode(true));
    }
    return {
      kind: 'section' as const,
      element: partialSection,
      groupId: sectionGroupId,
    };
  });
};

const extractPrintableSheetBlocks = (sheet: HTMLElement): PrintableSheetBlock[] => {
  const blocks: PrintableSheetBlock[] = [];

  Array.from(sheet.children).forEach(child => {
    if (!(child instanceof HTMLElement)) {
      return;
    }

    if (child.classList.contains('space-y-3')) {
      Array.from(child.children).forEach((sectionChild, sectionIndex) => {
        if (!(sectionChild instanceof HTMLElement)) {
          return;
        }
        blocks.push(...explodePrintableSectionBlock(sectionChild, sectionIndex));
      });
      return;
    }

    if (child.classList.contains('clinical-document-footer')) {
      blocks.push({
        kind: 'single',
        element: child.cloneNode(true) as HTMLElement,
      });
      return;
    }

    blocks.push({
      kind: 'single',
      element: child.cloneNode(true) as HTMLElement,
    });
  });

  return blocks;
};

const paginateInlinePrintSheet = async (sheetClone: HTMLElement): Promise<PaginatedPrintPage[]> => {
  const sourceBlocks = extractPrintableSheetBlocks(sheetClone);
  const fallbackPage = [
    {
      sheetHtml: sheetClone.outerHTML,
      pageNumber: 1,
      totalPages: 1,
      isLastPage: true,
    },
  ];

  if (sourceBlocks.length === 0) {
    return fallbackPage;
  }

  const heights = await measurePrintableSheetBlockHeights(sheetClone, sourceBlocks);

  const usableContentHeightPx = Math.max(1, PRINT_USABLE_HEIGHT_PX - PRINT_FOOTER_RESERVE_PX);
  const pages: PrintableSheetBlock[][] = [];
  let currentPage: PrintableSheetBlock[] = [];
  let currentHeight = 0;

  sourceBlocks.forEach((block, index) => {
    const measuredHeight = heights[index] || block.element.scrollHeight || 0;
    const childHeight =
      measuredHeight + (block.kind === 'section' ? PRINT_SECTION_HEIGHT_BUFFER_PX : 0);
    const exceedsCurrentPage =
      currentPage.length > 0 && currentHeight + childHeight > usableContentHeightPx;

    if (exceedsCurrentPage) {
      pages.push(currentPage);
      currentPage = [];
      currentHeight = 0;
    }

    currentPage.push(block);
    currentHeight += childHeight;
  });

  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  if (pages.length === 0) {
    return fallbackPage;
  }

  const totalPages = pages.length;
  return pages.map((pageChildren, index) => {
    const pageSheet = sheetClone.cloneNode(false) as HTMLElement;
    pageSheet.innerHTML = '';
    let sectionsWrapper: HTMLDivElement | null = null;
    let lastMergedSection: { groupId?: string; element: HTMLElement } | null = null;

    pageChildren.forEach(block => {
      if (block.kind === 'section') {
        if (!sectionsWrapper) {
          sectionsWrapper = document.createElement('div');
          sectionsWrapper.className = 'space-y-3';
          pageSheet.appendChild(sectionsWrapper);
          lastMergedSection = null;
        }

        if (lastMergedSection && lastMergedSection.groupId === block.groupId) {
          const targetContainer = lastMergedSection.element.querySelector(
            '.clinical-document-plan-subsections'
          );
          const sourceContainer = block.element.querySelector(
            '.clinical-document-plan-subsections'
          );
          if (targetContainer instanceof HTMLElement && sourceContainer instanceof HTMLElement) {
            Array.from(sourceContainer.children).forEach(subsectionNode => {
              targetContainer.appendChild(subsectionNode.cloneNode(true));
            });
            return;
          }
        }

        const clonedSection = block.element.cloneNode(true) as HTMLElement;
        sectionsWrapper.appendChild(clonedSection);
        lastMergedSection = {
          groupId: block.groupId,
          element: clonedSection,
        };
        return;
      }

      sectionsWrapper = null;
      lastMergedSection = null;
      pageSheet.appendChild(block.element.cloneNode(true) as HTMLElement);
    });

    return {
      sheetHtml: pageSheet.outerHTML,
      pageNumber: index + 1,
      totalPages,
      isLastPage: index === totalPages - 1,
    };
  });
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
  const html = await buildClinicalDocumentPrintHtml({
    includeAppStyles: true,
  });
  if (!html) {
    return null;
  }

  try {
    return await generateBackendPrintStyledPdfBlob(html);
  } catch (error) {
    console.warn(
      '[clinicalDocumentPrintPdfService] backend render failed, falling back to client snapshot:',
      error
    );
  }

  try {
    return await generateDomSnapshotPdfBlob(html);
  } catch (error) {
    console.warn('[clinicalDocumentPrintPdfService] client snapshot failed:', error);
    return null;
  }
};

export const openClinicalDocumentBrowserPrintPreview = async (
  pageTitle: string
): Promise<boolean> => {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return false;
  }

  const sheet = document.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
  if (!(sheet instanceof HTMLElement)) {
    return false;
  }

  const existingRoot = document.getElementById(CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID);
  if (existingRoot) {
    existingRoot.remove();
  }

  const existingStyle = document.getElementById(CLINICAL_DOCUMENT_INLINE_PRINT_STYLE_ID);
  if (existingStyle) {
    existingStyle.remove();
  }

  const sheetClone = sheet.cloneNode(true) as HTMLElement;
  await sanitizeSheetClone(sheet, sheetClone);

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
  printStyle.textContent = '@page { margin: 8mm; }';

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
    document.getElementById(CLINICAL_DOCUMENT_INLINE_PRINT_MEASURE_ID)?.remove();
    document.title = originalTitle;
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup, { once: true });
  window.setTimeout(() => {
    cleanup();
  }, 60_000);
  window.setTimeout(() => {
    window.print();
  }, 100);

  return true;
};
