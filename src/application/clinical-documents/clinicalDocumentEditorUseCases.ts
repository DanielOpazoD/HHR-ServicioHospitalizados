import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import type { ClinicalDocumentDraftBaseState } from '@/features/clinical-documents/hooks/clinicalDocumentDraftReducer';
import {
  buildClinicalDocumentActor,
  hydrateLegacyClinicalDocument,
  serializeClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { executePersistClinicalDocumentDraft } from '@/application/clinical-documents/clinicalDocumentUseCases';
import { openClinicalDocumentBrowserPrintPreview } from '@/features/clinical-documents/services/clinicalDocumentPrintPdfService';
import type { ApplicationOutcome } from '@/application/shared/applicationOutcome';

export type ClinicalDocumentDraftLoadResolution =
  | { kind: 'clear' }
  | {
      kind: 'load';
      document: ClinicalDocumentRecord | null;
      snapshot: string;
    }
  | {
      kind: 'stage_remote';
      document: ClinicalDocumentRecord;
      snapshot: string;
    };

interface ResolveClinicalDocumentDraftLoadInput {
  documents: ClinicalDocumentRecord[];
  selectedDocumentId: string | null;
  currentDraft: ClinicalDocumentRecord | null;
  baseState: ClinicalDocumentDraftBaseState;
  hasLocalDraftChanges: boolean;
}

export const resolveClinicalDocumentDraftLoad = ({
  documents,
  selectedDocumentId,
  currentDraft,
  baseState,
  hasLocalDraftChanges,
}: ResolveClinicalDocumentDraftLoadInput): ClinicalDocumentDraftLoadResolution => {
  if (!selectedDocumentId) {
    return { kind: 'clear' };
  }

  const selected = documents.find(document => document.id === selectedDocumentId) || null;
  const hydrated = selected ? hydrateLegacyClinicalDocument(structuredClone(selected)) : null;
  const snapshot = serializeClinicalDocument(hydrated);
  const isSameSelectedDocument = Boolean(currentDraft) && currentDraft?.id === selectedDocumentId;

  if (isSameSelectedDocument && hasLocalDraftChanges) {
    const isNewRemoteVersion =
      hydrated?.audit.updatedAt &&
      hydrated.audit.updatedAt !== baseState.updatedAt &&
      snapshot !== baseState.snapshot;

    if (isNewRemoteVersion && hydrated) {
      return {
        kind: 'stage_remote',
        document: hydrated,
        snapshot,
      };
    }
  }

  return {
    kind: 'load',
    document: hydrated,
    snapshot,
  };
};

interface PersistClinicalDocumentEditorDraftInput {
  record: ClinicalDocumentRecord;
  hospitalId: string;
  role: string;
  user: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  };
  reason: 'autosave' | 'manual';
}

export const executePersistClinicalDocumentEditorDraft = (
  input: PersistClinicalDocumentEditorDraftInput
): Promise<ApplicationOutcome<ClinicalDocumentRecord | null>> =>
  executePersistClinicalDocumentDraft(
    input.record,
    input.hospitalId,
    buildClinicalDocumentActor(input.user, input.role),
    input.reason
  );

export const executeOpenClinicalDocumentPrint = (
  record: ClinicalDocumentRecord
): Promise<boolean> => openClinicalDocumentBrowserPrintPreview(record.title, record.documentType);
