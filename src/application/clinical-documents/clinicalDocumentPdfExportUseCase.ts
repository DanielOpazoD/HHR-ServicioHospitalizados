import {
  exportClinicalDocumentPdfViaBackend,
  generateClinicalDocumentPdfBlob,
  type ClinicalDocumentAnnexPrintMode,
  type ClinicalDocumentPdfMeta,
  type ClinicalDocumentRecord,
} from '@/features/clinical-documents/internal';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/shared/contracts/applicationOutcome';
import {
  defaultClinicalDocumentPort,
  type ClinicalDocumentPort,
} from '@/application/ports/clinicalDocumentPort';

interface ClinicalDocumentPdfExportDependencies {
  clinicalDocumentPort?: ClinicalDocumentPort;
}

export interface ExportClinicalDocumentPdfInput {
  record: ClinicalDocumentRecord;
  hospitalId: string;
  fileName: string;
  targetFolderId?: string;
  targetFolderPath?: string;
  annexMode?: ClinicalDocumentAnnexPrintMode;
}

export interface ExportClinicalDocumentPdfOutput {
  pdf: ClinicalDocumentPdfMeta;
}

export const executeExportClinicalDocumentPdf = async (
  {
    record,
    hospitalId,
    fileName,
    targetFolderId,
    targetFolderPath,
    annexMode,
  }: ExportClinicalDocumentPdfInput,
  dependencies: ClinicalDocumentPdfExportDependencies = {}
): Promise<ApplicationOutcome<ExportClinicalDocumentPdfOutput | null>> => {
  void targetFolderId;
  void targetFolderPath;
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    const pdfBlob = await generateClinicalDocumentPdfBlob(record, { annexMode });
    const result = await exportClinicalDocumentPdfViaBackend({
      documentId: record.id,
      fileName,
      documentType: record.documentType,
      patientName: record.patientName,
      patientRut: record.patientRut,
      episodeKey: record.episodeKey,
      pdfBlob,
    });

    const pdf: ClinicalDocumentPdfMeta = {
      fileId: result.fileId,
      webViewLink: result.webViewLink,
      folderPath: result.folderPath,
      exportedAt: new Date().toISOString(),
      exportStatus: 'exported',
    };

    await clinicalDocumentPort.savePdfMetadata(record.id, pdf, hospitalId);
    return createApplicationSuccess({ pdf });
  } catch (error) {
    const failedPdf: ClinicalDocumentPdfMeta = {
      exportStatus: 'failed',
      exportError: error instanceof Error ? error.message : 'Error desconocido',
    };

    try {
      await clinicalDocumentPort.savePdfMetadata(record.id, failedPdf, hospitalId);
    } catch {
      // Keep the original export error as the user-facing failure.
    }

    return createApplicationFailed({ pdf: failedPdf }, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo exportar el PDF clínico.',
      },
    ]);
  }
};
