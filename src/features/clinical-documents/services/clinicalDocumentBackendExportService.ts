import { httpsCallable } from 'firebase/functions';
import type { ClinicalDocumentType } from '@/features/clinical-documents/domain/entities';
import { z } from 'zod';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';

interface ExportClinicalDocumentPdfPayload {
  documentId: string;
  fileName: string;
  documentType: ClinicalDocumentType;
  patientName: string;
  patientRut: string;
  episodeKey: string;
  contentBase64: string;
  mimeType: string;
}

interface ExportClinicalDocumentPdfResult {
  fileId: string;
  webViewLink: string;
  folderPath: string;
  usedBackend: boolean;
}

const exportClinicalDocumentPdfResultSchema = z.object({
  fileId: z.string(),
  webViewLink: z.string().url(),
  folderPath: z.string(),
  usedBackend: z.boolean(),
});

const blobToBase64 = async (blob: Blob): Promise<string> => {
  const arrayBuffer = await blob.arrayBuffer();
  const runtimeBuffer = (
    globalThis as unknown as {
      Buffer?: { from: (data: ArrayBuffer) => { toString: (encoding: string) => string } };
    }
  ).Buffer;

  if (runtimeBuffer) {
    return runtimeBuffer.from(arrayBuffer).toString('base64');
  }

  const bytes = new Uint8Array(arrayBuffer);
  const chunkSize = 0x8000;
  let binary = '';

  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  return btoa(binary);
};

export const exportClinicalDocumentPdfViaBackend = async ({
  documentId,
  fileName,
  documentType,
  patientName,
  patientRut,
  episodeKey,
  pdfBlob,
}: {
  documentId: string;
  fileName: string;
  documentType: ClinicalDocumentType;
  patientName: string;
  patientRut: string;
  episodeKey: string;
  pdfBlob: Blob;
}): Promise<ExportClinicalDocumentPdfResult> => {
  const functions = await defaultFunctionsRuntime.getFunctions();
  const callable = httpsCallable<ExportClinicalDocumentPdfPayload, ExportClinicalDocumentPdfResult>(
    functions,
    'exportClinicalDocumentPdfToDrive'
  );

  const contentBase64 = await blobToBase64(pdfBlob);
  const response = await callable({
    documentId,
    fileName,
    documentType,
    patientName,
    patientRut,
    episodeKey,
    contentBase64,
    mimeType: pdfBlob.type || 'application/pdf',
  });

  return exportClinicalDocumentPdfResultSchema.parse(response.data);
};
