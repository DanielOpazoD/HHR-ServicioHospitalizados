/**
 * clinicalDocumentPasteController
 *
 * Pure logic for classifying and processing clipboard content pasted
 * into the clinical document rich-text editor.
 *
 * Paste content is classified into three categories:
 *  - `image-file`: a bitmap image (screenshot, copied image)
 *  - `html`: rich HTML content (tables, formatted text, inline images)
 *  - `plain-text`: unformatted text fallback
 *
 * The controller returns a descriptor; the hook performs DOM mutations.
 */

import { sanitizePastedHtml } from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type PasteContentKind = 'image-file' | 'html' | 'plain-text' | 'empty';

export interface PasteContentImageFile {
  kind: 'image-file';
  file: File;
}

export interface PasteContentHtml {
  kind: 'html';
  sanitizedHtml: string;
}

export interface PasteContentPlainText {
  kind: 'plain-text';
  text: string;
}

export interface PasteContentEmpty {
  kind: 'empty';
}

export type PasteContentDescriptor =
  | PasteContentImageFile
  | PasteContentHtml
  | PasteContentPlainText
  | PasteContentEmpty;

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Inspects a clipboard's `DataTransfer` and returns a descriptor
 * describing what was pasted. The caller decides how to insert the
 * content into the DOM.
 *
 * Priority order:
 *  1. Image files (screenshot, pasted bitmap)
 *  2. HTML content (sanitised)
 *  3. Plain-text fallback
 *  4. Empty (nothing useful)
 */
export const classifyPasteContent = (clipboardData: DataTransfer): PasteContentDescriptor => {
  // 1. Image files
  const imageFile = Array.from(clipboardData.files).find(f => f.type.startsWith('image/'));
  if (imageFile) {
    return { kind: 'image-file', file: imageFile };
  }

  // 2. Rich HTML
  const rawHtml = clipboardData.getData('text/html');
  const plainText = clipboardData.getData('text/plain');

  if (rawHtml) {
    return { kind: 'html', sanitizedHtml: sanitizePastedHtml(rawHtml) };
  }

  // 3. Plain text
  if (plainText) {
    return { kind: 'plain-text', text: plainText };
  }

  return { kind: 'empty' };
};

// ---------------------------------------------------------------------------
// Image helpers
// ---------------------------------------------------------------------------

/**
 * Reads a File as a base64 data-URL string.
 * Returns a Promise that resolves with the data URL.
 */
export const readFileAsDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('FileReader result is not a string'));
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });

/**
 * Builds the `<img>` HTML snippet to embed a pasted image.
 */
export const buildPastedImageHtml = (dataUrl: string): string =>
  `<img src="${dataUrl}" alt="Imagen pegada" style="max-width:100%">`;
