import { CLINICAL_DOCUMENT_BRANDING } from '@/features/clinical-documents/domain/branding';

export const CLINICAL_DOCUMENT_SHEET_ID = 'clinical-document-sheet';
export const CLINICAL_DOCUMENT_INLINE_PRINT_ROOT_ID = 'clinical-document-inline-print-root';
export const CLINICAL_DOCUMENT_INLINE_PRINT_STYLE_ID = 'clinical-document-inline-print-style';
const ASSET_LOAD_TIMEOUT_MS = 4_000;

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
    return await readBlobAsDataUrl(await response.blob());
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
    return await readBlobAsDataUrl(await response.blob());
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

export const sanitizeClinicalDocumentSheetClone = async (
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

export const waitForClinicalDocumentSheetAssets = async (
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
      // Best effort.
    }
  }
};

export const escapeHtmlAttr = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');

export const escapeHtmlText = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

export const escapeStyleText = (value: string): string => value.replace(/<\/style/gi, '<\\/style');
