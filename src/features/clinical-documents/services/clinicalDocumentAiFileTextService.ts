import {
  createApplicationFailed,
  createApplicationIssue,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';
import {
  normalizeClinicalDocumentAiImportText,
  validateClinicalDocumentAiImportFile,
  validateClinicalDocumentAiImportSourceText,
} from '@/features/clinical-documents/controllers/clinicalDocumentAiImportController';

const normalizePdfText = (text: string): string =>
  normalizeClinicalDocumentAiImportText(
    text
      .replace(/\u00a2/g, 'ó')
      .replace(/\u00b0/g, 'o')
      .replace(/\r/g, '\n')
  );

const groupTextItemsIntoLines = (items: unknown[]): string[] => {
  const positioned = items
    .filter(
      (item): item is { str: string; transform: number[] | Float32Array } =>
        typeof item === 'object' &&
        item !== null &&
        'str' in item &&
        typeof item.str === 'string' &&
        item.str.trim().length > 0 &&
        'transform' in item &&
        (Array.isArray(item.transform) || item.transform instanceof Float32Array)
    )
    .map(item => ({
      text: item.str.trim(),
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
    }))
    .sort((a, b) => (Math.abs(b.y - a.y) > 1 ? b.y - a.y : a.x - b.x));

  const lines: Array<{ y: number; tokens: Array<{ text: string; x: number }> }> = [];

  for (const item of positioned) {
    const existing = lines.find(line => Math.abs(line.y - item.y) <= 2);
    if (existing) {
      existing.tokens.push({ text: item.text, x: item.x });
    } else {
      lines.push({ y: item.y, tokens: [{ text: item.text, x: item.x }] });
    }
  }

  return lines
    .sort((a, b) => b.y - a.y)
    .map(line =>
      line.tokens
        .sort((a, b) => a.x - b.x)
        .map(token => token.text)
        .join(' ')
        .replace(/\s*:\s*/g, ': ')
        .replace(/[ ]{2,}/g, ' ')
        .trim()
    )
    .filter(Boolean);
};

const extractPdfText = async (buffer: ArrayBuffer): Promise<string> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.mjs',
    import.meta.url
  ).toString();

  const document = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useWorkerFetch: false,
    isEvalSupported: false,
  }).promise;

  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
    const page = await document.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const lines = groupTextItemsIntoLines(
      textContent.items.filter(item => typeof item === 'object' && item !== null)
    );
    pages.push(lines.join('\n'));
  }

  return normalizePdfText(pages.join('\n\n'));
};

const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return normalizeClinicalDocumentAiImportText(result.value || '');
};

const buildFailedTextOutcome = (message: string): ApplicationOutcome<string | null> =>
  createApplicationFailed(
    null,
    [
      createApplicationIssue('validation', message, {
        userSafeMessage: message,
        retryable: false,
      }),
    ],
    { userSafeMessage: message, retryable: false }
  );

export const extractClinicalDocumentAiImportFileText = async (
  file: File
): Promise<ApplicationOutcome<string | null>> => {
  const fileValidation = validateClinicalDocumentAiImportFile(file);
  if (!fileValidation.ok) {
    return buildFailedTextOutcome(fileValidation.message || 'Archivo no válido.');
  }

  try {
    const buffer = await file.arrayBuffer();
    const normalizedName = file.name.toLowerCase();
    const text =
      normalizedName.endsWith('.pdf') || file.type === 'application/pdf'
        ? await extractPdfText(buffer)
        : await extractDocxText(buffer);
    const textValidation = validateClinicalDocumentAiImportSourceText(text);

    if (!textValidation.ok) {
      return buildFailedTextOutcome(textValidation.message || 'No se pudo extraer texto útil.');
    }

    return createApplicationSuccess(text);
  } catch {
    return buildFailedTextOutcome('No se pudo leer el archivo para importarlo con IA.');
  }
};
