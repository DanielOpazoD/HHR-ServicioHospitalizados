import {
  CLINICAL_DOCUMENT_SHEET_ID,
  waitForClinicalDocumentSheetAssets,
} from '@/features/clinical-documents/services/clinicalDocumentPrintSupport';

type Html2CanvasModule = typeof import('html2canvas');
type JsPdfModule = typeof import('jspdf');

let html2canvasModulePromise: Promise<Html2CanvasModule> | null = null;
let jsPdfModulePromise: Promise<JsPdfModule> | null = null;

const loadHtml2Canvas = async (): Promise<Html2CanvasModule['default']> => {
  if (!html2canvasModulePromise) {
    html2canvasModulePromise = import('html2canvas');
  }

  const module = await html2canvasModulePromise;
  return module.default;
};

const loadJsPdf = async (): Promise<JsPdfModule['jsPDF']> => {
  if (!jsPdfModulePromise) {
    jsPdfModulePromise = import('jspdf');
  }

  const module = await jsPdfModulePromise;
  return module.jsPDF;
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

export const generateClinicalDocumentDomSnapshotPdfBlob = async (html: string): Promise<Blob> => {
  const isolated = await createIsolatedPrintFrame(html);

  try {
    const [html2canvas, JsPdf] = await Promise.all([loadHtml2Canvas(), loadJsPdf()]);

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
    const pdf = new JsPdf({
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
