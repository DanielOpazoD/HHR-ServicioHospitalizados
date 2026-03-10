import { httpsCallable } from 'firebase/functions';
import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { getFunctionsInstance } from '@/firebaseConfig';
import { buildClinicalDocumentPrintHtml } from '@/features/clinical-documents/services/clinicalDocumentPrintHtmlBuilder';
import {
  CLINICAL_DOCUMENT_SHEET_ID,
  waitForClinicalDocumentSheetAssets,
} from '@/features/clinical-documents/services/clinicalDocumentPrintSupport';

interface RenderClinicalDocumentPdfPayload {
  html: string;
}

interface RenderClinicalDocumentPdfResult {
  contentBase64: string;
  mimeType: string;
}

const decodeBase64Pdf = (contentBase64: string, mimeType: string): Blob => {
  const clean = contentBase64.replace(/\s+/g, '');
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType || 'application/pdf' });
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
      frameWindow.setTimeout(() => resolve(), 4_000);
    });

    const sheet = frameDocument.getElementById(CLINICAL_DOCUMENT_SHEET_ID);
    if (!(sheet instanceof HTMLElement)) {
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
    await waitForClinicalDocumentSheetAssets(
      isolated.sheet,
      isolated.frameDocument,
      isolated.frameWindow
    );

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

export const generateClinicalDocumentPrintStyledPdfBlob = async (
  record?: ClinicalDocumentRecord
): Promise<Blob | null> => {
  const html = await buildClinicalDocumentPrintHtml({
    includeAppStyles: true,
    documentType: record?.documentType,
    pageTitle: record?.title,
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
