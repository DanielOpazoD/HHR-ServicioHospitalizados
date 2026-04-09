import type {
  ClinicalDocumentAuditActor,
  ClinicalDocumentRecord,
} from '@/features/clinical-documents/domain/entities';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/shared/contracts/applicationOutcome';
import {
  defaultClinicalDocumentPort,
  type ClinicalDocumentPort,
} from '@/application/ports/clinicalDocumentPort';

type PersistReason = 'autosave' | 'manual' | 'admin_fix';

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
