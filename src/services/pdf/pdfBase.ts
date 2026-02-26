/**
 * PDF Base Utilities
 *
 * Common functions for PDF manipulation using pdf-lib.
 */
import { PDFDocument, PDFName } from 'pdf-lib';

/**
 * Injects a JavaScript auto-print action into the PDF catalog.
 */
export const injectPrintScript = (pdfDoc: PDFDocument): void => {
  pdfDoc.catalog.set(
    PDFName.of('OpenAction'),
    pdfDoc.context.obj({
      Type: 'Action',
      S: 'JavaScript',
      JS: 'this.print({bUI: true, bSilent: false, bShrinkToFit: true});',
    })
  );
};

/**
 * Saves and triggers a browser download for a PDF document.
 * Supports File System Access API (Save As) with fallback.
 */
export const saveAndDownloadPdf = async (
  pdfSource: PDFDocument | Uint8Array,
  suggestedName: string
): Promise<void> => {
  const pdfBytes = pdfSource instanceof PDFDocument ? await pdfSource.save() : pdfSource;

  // Try native Save As dialog
  if ('showSaveFilePicker' in window) {
    try {
      const handle = await (
        window as unknown as {
          showSaveFilePicker: (opts: unknown) => Promise<FileSystemFileHandle>;
        }
      ).showSaveFilePicker({
        suggestedName,
        types: [
          {
            description: 'PDF Document',
            accept: { 'application/pdf': ['.pdf'] },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(pdfBytes as any);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
    }
  }

  // Fallback: classic download link
  const blob = new Blob([pdfBytes as any], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = suggestedName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
