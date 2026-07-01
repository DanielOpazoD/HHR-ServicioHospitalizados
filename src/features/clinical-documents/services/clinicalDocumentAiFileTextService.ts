import {
  createApplicationFailed,
  createApplicationIssue,
  createApplicationSuccess,
} from '@/shared/contracts/applicationOutcomeFactories';
import type { ApplicationOutcome } from '@/shared/contracts/applicationOutcomeTypes';
import PizZip from 'pizzip';
import {
  normalizeClinicalDocumentAiImportText,
  validateClinicalDocumentAiImportFile,
  validateClinicalDocumentAiImportSourceText,
} from '@/features/clinical-documents/controllers/clinicalDocumentAiImportController';
import { loadPdfJsTextRuntime } from '@/services/pdf/pdfJsTextRuntime';

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
  const pdfjs = await loadPdfJsTextRuntime();

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

const WORDPROCESSINGML_NAMESPACE = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';

const readDocxElementText = (element: Element): string => {
  const localName = element.localName;
  if (localName === 't') {
    return element.textContent || '';
  }
  if (localName === 'tab') {
    return '\t';
  }
  if (localName === 'br' || localName === 'cr') {
    return '\n';
  }

  return Array.from(element.children).map(readDocxElementText).join('');
};

const parseDocxDocumentText = (documentXml: string): string => {
  const xmlDocument = new DOMParser().parseFromString(documentXml.trim(), 'application/xml');
  if (xmlDocument.getElementsByTagName('parsererror').length > 0) {
    throw new Error('DOCX document.xml is not valid XML.');
  }

  const paragraphs = Array.from(
    xmlDocument.getElementsByTagNameNS(WORDPROCESSINGML_NAMESPACE, 'p')
  );
  const lines =
    paragraphs.length > 0
      ? paragraphs.map(paragraph => readDocxElementText(paragraph))
      : Array.from(xmlDocument.getElementsByTagNameNS(WORDPROCESSINGML_NAMESPACE, 't')).map(
          node => node.textContent || ''
        );

  return normalizeClinicalDocumentAiImportText(lines.filter(Boolean).join('\n'));
};

const extractDocxText = async (buffer: ArrayBuffer): Promise<string> => {
  const zip = new PizZip(buffer);
  const documentFile = zip.file('word/document.xml');
  if (!documentFile) {
    throw new Error('DOCX document.xml was not found.');
  }

  return parseDocxDocumentText(documentFile.asText());
};

const readFileArrayBuffer = (file: File): Promise<ArrayBuffer> => {
  if (typeof file.arrayBuffer === 'function') {
    return file.arrayBuffer();
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error('No se pudo leer el archivo.'));
    reader.onload = () => {
      if (!(reader.result instanceof ArrayBuffer)) {
        reject(new Error('El archivo no se leyó como ArrayBuffer.'));
        return;
      }
      resolve(reader.result);
    };
    reader.readAsArrayBuffer(file);
  });
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
    const buffer = await readFileArrayBuffer(file);
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
