/**
 * Document Generator Service
 * Generates DOCX, XLSX, and PDF documents for patient transfers
 */

import {
  HospitalConfig,
  QuestionnaireResponse,
  TransferPatientData,
  GeneratedDocument,
} from '@/types/transferDocuments';
import {
  recordTransferDocumentGenerationFailure,
  recordTransferTemplateFallback,
  recordUnknownTransferTemplate,
} from './transferDocumentTelemetryController';
import { createGeneratedDocument } from './transferGeneratedDocumentController';
import { getSuggestedExtension } from './transferDocumentNamingController';

type TemplateGeneratorModule = typeof import('./templateGeneratorService');
type TransferFallbackRegistryModule = typeof import('./transferDocumentFallbackRegistry');

let templateGeneratorModulePromise: Promise<TemplateGeneratorModule> | null = null;
let transferFallbackRegistryModulePromise: Promise<TransferFallbackRegistryModule> | null = null;

const loadTemplateGeneratorModule = async (): Promise<TemplateGeneratorModule> => {
  if (!templateGeneratorModulePromise) {
    templateGeneratorModulePromise = import('./templateGeneratorService');
  }

  return templateGeneratorModulePromise;
};

const loadTransferFallbackRegistryModule = async (): Promise<TransferFallbackRegistryModule> => {
  if (!transferFallbackRegistryModulePromise) {
    transferFallbackRegistryModulePromise = import('./transferDocumentFallbackRegistry');
  }

  return transferFallbackRegistryModulePromise;
};

const triggerBrowserDownload = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

type DirectoryHandle = {
  getFileHandle: (name: string, options?: { create?: boolean }) => Promise<FileSystemFileHandle>;
};

const saveBlobWithPicker = async (
  blob: Blob,
  suggestedName: string,
  mimeType: string
): Promise<'saved' | 'cancelled'> => {
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
            description: 'Archivo',
            accept: {
              [mimeType]: [getSuggestedExtension(suggestedName)],
            },
          },
        ],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  triggerBrowserDownload(blob, suggestedName);
  return 'saved';
};

const createDocumentFromTemplateBlob = (
  templateId: string,
  templateName: string,
  patientName: string,
  templateFormat: 'docx' | 'xlsx' | 'pdf',
  templateBlob: Blob,
  processedBlob: Blob
): GeneratedDocument =>
  createGeneratedDocument(
    templateId,
    templateName,
    patientName,
    templateFormat,
    templateBlob.type,
    processedBlob
  );

// ============================================================================
// Main Generator Function
// ============================================================================

/**
 * Generate all enabled documents for a transfer
 */
export const generateTransferDocuments = async (
  patientData: TransferPatientData,
  responses: QuestionnaireResponse,
  hospital: HospitalConfig
): Promise<GeneratedDocument[]> => {
  const enabledTemplates = hospital.templates.filter(t => t.enabled);
  const templateGenerator = await loadTemplateGeneratorModule();
  const tags = templateGenerator.mapDataToTags(patientData, responses);
  const generatedDocs = await Promise.all(
    enabledTemplates.map(async template => {
      try {
        let doc: GeneratedDocument | null = null;
        const templateFileName = `${hospital.code}/${template.id}.${template.format}`;
        const templateBlob = await templateGenerator.fetchTemplateFromStorage(templateFileName);

        if (templateBlob) {
          let processedBlob: Blob;
          if (template.format === 'docx') {
            processedBlob = await templateGenerator.generateDocxFromTemplate(templateBlob, tags);
          } else if (template.format === 'xlsx') {
            processedBlob = await templateGenerator.generateXlsxFromTemplate(templateBlob, tags);
          } else {
            processedBlob = templateBlob;
          }

          doc = createDocumentFromTemplateBlob(
            template.id,
            template.name,
            patientData.patientName,
            template.format,
            templateBlob,
            processedBlob
          );
        }

        if (!doc) {
          recordTransferTemplateFallback(template.id, hospital.code);
          doc = await generateFallbackDocument(template.id, patientData, responses, hospital);
        }

        return doc;
      } catch (error) {
        recordTransferDocumentGenerationFailure(template.id, hospital.code, error);
        return null;
      }
    })
  );

  return generatedDocs.filter((doc): doc is GeneratedDocument => doc !== null);
};

/**
 * Route to the correct fallback generator
 */
const generateFallbackDocument = async (
  templateId: string,
  patientData: TransferPatientData,
  responses: QuestionnaireResponse,
  hospital: HospitalConfig
): Promise<GeneratedDocument | null> => {
  const fallbackRegistry = await loadTransferFallbackRegistryModule();
  const fallbackGenerator = fallbackRegistry.resolveTransferFallbackGenerator(templateId);
  if (!fallbackGenerator) {
    recordUnknownTransferTemplate(templateId);
    return null;
  }
  return fallbackGenerator(patientData, responses, hospital);
};

/**
 * Download a single document
 */
export const downloadDocument = async (doc: GeneratedDocument): Promise<'saved' | 'cancelled'> => {
  return await saveBlobWithPicker(doc.blob, doc.fileName, doc.mimeType);
};

/**
 * Download all documents to a folder when supported, otherwise ZIP them.
 */
export const downloadAllDocuments = async (
  documents: GeneratedDocument[]
): Promise<'directory' | 'zip' | 'cancelled'> => {
  if ('showDirectoryPicker' in window) {
    try {
      const directoryHandle = await (
        window as unknown as {
          showDirectoryPicker: (opts?: unknown) => Promise<DirectoryHandle>;
        }
      ).showDirectoryPicker({
        mode: 'readwrite',
      });

      await Promise.all(
        documents.map(async doc => {
          const fileHandle = await directoryHandle.getFileHandle(doc.fileName, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(doc.blob);
          await writable.close();
        })
      );

      return 'directory';
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return 'cancelled';
      }
    }
  }

  const { default: PizZip } = await import('pizzip');
  const zip = new PizZip();

  await Promise.all(
    documents.map(async doc => {
      const bytes = new Uint8Array(await doc.blob.arrayBuffer());
      zip.file(doc.fileName, bytes);
    })
  );

  const zipBlob = zip.generate({
    type: 'blob',
    compression: 'DEFLATE',
  }) as Blob;

  const archiveName =
    documents.length === 1
      ? documents[0].fileName.replace(/\.[^.]+$/, '.zip')
      : `documentos-traslado-${new Date().toISOString().slice(0, 10)}.zip`;

  await saveBlobWithPicker(zipBlob, archiveName, 'application/zip');
  return 'zip';
};
