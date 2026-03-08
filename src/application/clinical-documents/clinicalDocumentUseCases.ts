import type {
  ClinicalDocumentAuditActor,
  ClinicalDocumentPdfMeta,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';
import { generateClinicalDocumentPdfBlob } from '@/features/clinical-documents/services/clinicalDocumentPdfService';
import { exportClinicalDocumentPdfViaBackend } from '@/features/clinical-documents/services/clinicalDocumentBackendExportService';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';
import {
  defaultClinicalDocumentPort,
  type ClinicalDocumentPort,
} from '@/application/ports/clinicalDocumentPort';

type PersistReason = 'autosave' | 'manual';

interface ClinicalDocumentUseCaseDependencies {
  clinicalDocumentPort?: ClinicalDocumentPort;
}

const appendVersionAudit = (
  record: ClinicalDocumentRecord,
  actor: ClinicalDocumentAuditActor,
  reason: ClinicalDocumentRecord['versionHistory'][number]['reason'],
  now: string
): ClinicalDocumentRecord => ({
  ...record,
  currentVersion: record.currentVersion + 1,
  versionHistory: [
    ...record.versionHistory,
    {
      version: record.currentVersion + 1,
      savedAt: now,
      savedBy: actor,
      reason,
    },
  ],
  audit: {
    ...record.audit,
    updatedAt: now,
    updatedBy: actor,
  },
});

export const executeCreateClinicalDocumentDraft = async (
  record: ClinicalDocumentRecord,
  hospitalId: string,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): Promise<ApplicationOutcome<ClinicalDocumentRecord | null>> => {
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    const saved = await clinicalDocumentPort.createDraft(record, hospitalId);
    return createApplicationSuccess(saved);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo crear el borrador clínico.',
      },
    ]);
  }
};

export const executeListClinicalDocumentsByEpisodeKeys = async (
  episodeKeys: string[],
  hospitalId?: string,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): Promise<ApplicationOutcome<ClinicalDocumentRecord[]>> => {
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    const documents = await clinicalDocumentPort.listByEpisodeKeys(episodeKeys, hospitalId);
    return createApplicationSuccess(documents);
  } catch (error) {
    return createApplicationFailed(
      [],
      [
        {
          kind: 'unknown',
          message:
            error instanceof Error ? error.message : 'No se pudieron cargar documentos clínicos.',
        },
      ]
    );
  }
};

export const subscribeClinicalDocumentsByEpisode = (
  episodeKey: string,
  callback: (documents: ClinicalDocumentRecord[]) => void,
  hospitalId: string,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): (() => void) => {
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  return clinicalDocumentPort.subscribeByEpisode(episodeKey, callback, hospitalId);
};

export const executePersistClinicalDocumentDraft = async (
  record: ClinicalDocumentRecord,
  hospitalId: string,
  actor: ClinicalDocumentAuditActor,
  reason: PersistReason,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): Promise<ApplicationOutcome<ClinicalDocumentRecord | null>> => {
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    const now = new Date().toISOString();
    const saved = await clinicalDocumentPort.saveDraft(
      appendVersionAudit(record, actor, reason, now),
      hospitalId
    );
    return createApplicationSuccess(saved);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo guardar el documento.',
      },
    ]);
  }
};

export const executeDeleteClinicalDocument = async (
  documentId: string,
  hospitalId: string,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): Promise<ApplicationOutcome<null>> => {
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    await clinicalDocumentPort.delete(documentId, hospitalId);
    return createApplicationSuccess(null);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el documento.',
      },
    ]);
  }
};

export const executeSignClinicalDocument = async (
  record: ClinicalDocumentRecord,
  hospitalId: string,
  actor: ClinicalDocumentAuditActor,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): Promise<ApplicationOutcome<ClinicalDocumentRecord | null>> => {
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    const now = new Date().toISOString();
    const signed = await clinicalDocumentPort.sign(
      {
        ...appendVersionAudit(record, actor, 'signature', now),
        status: 'signed',
        isLocked: true,
        audit: {
          ...record.audit,
          updatedAt: now,
          updatedBy: actor,
          signedAt: now,
          signedBy: actor,
        },
      },
      hospitalId
    );
    return createApplicationSuccess(signed);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo firmar el documento.',
      },
    ]);
  }
};

export const executeUnsignClinicalDocument = async (
  record: ClinicalDocumentRecord,
  hospitalId: string,
  actor: ClinicalDocumentAuditActor,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): Promise<ApplicationOutcome<ClinicalDocumentRecord | null>> => {
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    const now = new Date().toISOString();
    const unsigned = await clinicalDocumentPort.unsign(
      {
        ...appendVersionAudit(record, actor, 'unsign', now),
        status: 'draft',
        isLocked: false,
        audit: {
          ...record.audit,
          updatedAt: now,
          updatedBy: actor,
          unsignedAt: now,
          unsignedBy: actor,
          signatureRevocations: [
            ...(record.audit.signatureRevocations || []),
            {
              revokedAt: now,
              revokedBy: actor,
              previousSignedAt: record.audit.signedAt,
              reason: 'same_day_update',
            },
          ],
        },
      },
      hospitalId
    );
    return createApplicationSuccess(unsigned);
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message: error instanceof Error ? error.message : 'No se pudo quitar la firma.',
      },
    ]);
  }
};

export interface ExportClinicalDocumentPdfInput {
  record: ClinicalDocumentRecord;
  hospitalId: string;
  fileName: string;
  targetFolderId?: string;
  targetFolderPath?: string;
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
  }: ExportClinicalDocumentPdfInput,
  dependencies: ClinicalDocumentUseCaseDependencies = {}
): Promise<ApplicationOutcome<ExportClinicalDocumentPdfOutput | null>> => {
  void targetFolderId;
  void targetFolderPath;
  const clinicalDocumentPort = dependencies.clinicalDocumentPort || defaultClinicalDocumentPort;
  try {
    const pdfBlob = await generateClinicalDocumentPdfBlob(record);
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
