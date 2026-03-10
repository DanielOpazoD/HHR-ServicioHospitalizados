import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import type { Dispatch, MutableRefObject, SetStateAction } from 'react';

import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { validateClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentValidationController';
import {
  hydrateLegacyClinicalDocument,
  serializeClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import {
  executePersistClinicalDocumentEditorDraft,
  resolveClinicalDocumentDraftLoad,
} from '@/application/clinical-documents/clinicalDocumentEditorUseCases';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';
import {
  clinicalDocumentDraftReducer,
  createClinicalDocumentDraftReducerInitialState,
  type ClinicalDocumentDraftBaseState,
} from '@/features/clinical-documents/hooks/clinicalDocumentDraftReducer';

interface UseClinicalDocumentWorkspaceDraftParams {
  documents: ClinicalDocumentRecord[];
  selectedDocumentId: string | null;
  canEdit: boolean;
  isActive: boolean;
  hospitalId: string;
  role: string;
  user: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
}

export interface ClinicalDocumentWorkspaceDraftState {
  draft: ClinicalDocumentRecord | null;
  hasPendingRemoteUpdate: boolean;
  hasLocalDraftChanges: boolean;
  applyPendingRemoteUpdate: () => void;
  discardLocalDraftChanges: () => void;
  setDraft: Dispatch<SetStateAction<ClinicalDocumentRecord | null>>;
  isSaving: boolean;
  setIsSaving: Dispatch<SetStateAction<boolean>>;
  validationIssues: Array<{ message: string }>;
  lastPersistedSnapshotRef: MutableRefObject<string>;
  patchPatientField: (fieldId: string, value: string) => void;
  patchPatientFieldLabel: (fieldId: string, label: string) => void;
  setPatientFieldVisibility: (fieldId: string, visible: boolean) => void;
  patchSection: (sectionId: string, content: string) => void;
  appendSectionText: (sectionId: string, text: string) => void;
  patchSectionTitle: (sectionId: string, title: string) => void;
  setSectionVisibility: (sectionId: string, visible: boolean) => void;
  moveSection: (sectionId: string, direction: 'up' | 'down') => void;
  reorderSection: (sourceSectionId: string, targetSectionId: string) => void;
  patchDocumentTitle: (title: string) => void;
  patchPatientInfoTitle: (title: string) => void;
  patchFooterLabel: (kind: 'medico' | 'especialidad', title: string) => void;
  patchDocumentMeta: (
    patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>
  ) => void;
  resetDocumentContent: () => void;
}

const hydrateIncomingDocument = (
  document: ClinicalDocumentRecord | null
): ClinicalDocumentRecord | null =>
  document ? hydrateLegacyClinicalDocument(structuredClone(document)) : null;

export const useClinicalDocumentWorkspaceDraft = ({
  documents,
  selectedDocumentId,
  canEdit,
  isActive,
  hospitalId,
  role,
  user,
}: UseClinicalDocumentWorkspaceDraftParams): ClinicalDocumentWorkspaceDraftState => {
  const [state, dispatch] = useReducer(
    clinicalDocumentDraftReducer,
    undefined,
    createClinicalDocumentDraftReducerInitialState
  );
  const autosaveTimerRef = useRef<number | null>(null);
  const lastPersistedSnapshotRef = useRef<string>('');
  const draftRef = useRef<ClinicalDocumentRecord | null>(null);
  const draftDirtyRef = useRef(false);
  const baseStateRef = useRef<ClinicalDocumentDraftBaseState>(state.baseState);

  const hasLocalDraftChanges = useMemo(
    () => serializeClinicalDocument(state.draft) !== lastPersistedSnapshotRef.current,
    [state.draft]
  );

  useEffect(() => {
    draftRef.current = state.draft;
    draftDirtyRef.current = hasLocalDraftChanges;
    baseStateRef.current = state.baseState;
    lastPersistedSnapshotRef.current = state.baseState.snapshot;
  }, [hasLocalDraftChanges, state.baseState, state.draft]);

  useEffect(() => {
    const resolution = resolveClinicalDocumentDraftLoad({
      documents,
      selectedDocumentId,
      currentDraft: draftRef.current,
      baseState: baseStateRef.current,
      hasLocalDraftChanges: draftDirtyRef.current,
    });

    if (resolution.kind === 'clear') {
      dispatch({ type: 'LOAD_DOCUMENT', document: null, snapshot: '' });
      return;
    }

    if (resolution.kind === 'preserve') {
      return;
    }

    if (resolution.kind === 'stage_remote') {
      dispatch({
        type: 'REMOTE_UPDATE_RECEIVED',
        document: resolution.document,
        snapshot: resolution.snapshot,
      });
      return;
    }

    dispatch({
      type: 'LOAD_DOCUMENT',
      document: resolution.document,
      snapshot: resolution.snapshot,
    });
  }, [documents, selectedDocumentId]);

  useEffect(() => {
    if (!state.hasPendingRemoteUpdate || draftDirtyRef.current) {
      return;
    }

    if (!state.pendingRemoteState.document || !state.pendingRemoteState.snapshot) {
      return;
    }

    dispatch({ type: 'APPLY_REMOTE_UPDATE' });
  }, [
    state.hasPendingRemoteUpdate,
    state.pendingRemoteState.document,
    state.pendingRemoteState.snapshot,
  ]);

  useEffect(() => {
    if (!state.draft || !canEdit || state.draft.isLocked || !isActive || !user) {
      return;
    }

    const draftSnapshot = serializeClinicalDocument(state.draft);
    if (draftSnapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      const requestedSnapshot = draftSnapshot;
      dispatch({ type: 'AUTOSAVE_REQUESTED' });

      try {
        const result = await executePersistClinicalDocumentEditorDraft({
          record: state.draft!,
          hospitalId,
          role,
          user,
          reason: 'autosave',
        });
        recordOperationalOutcome('clinical_document', 'autosave_clinical_document', result, {
          date: state.draft?.sourceDailyRecordDate,
          context: { documentId: state.draft?.id },
        });

        if (result.status === 'success' && result.data) {
          const savedSnapshot = serializeClinicalDocument(result.data);
          const currentDraftSnapshot = serializeClinicalDocument(draftRef.current);

          if (currentDraftSnapshot === requestedSnapshot) {
            lastPersistedSnapshotRef.current = savedSnapshot;
            dispatch({
              type: 'AUTOSAVE_MARK_CLEAN',
              document: result.data,
              snapshot: savedSnapshot,
            });
          } else {
            dispatch({
              type: 'AUTOSAVE_COMMIT_BASE',
              document: result.data,
              snapshot: savedSnapshot,
            });
          }
          return;
        }

        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'autosave_clinical_document_rejected',
          date: state.draft?.sourceDailyRecordDate,
          issues: [result.issues[0]?.message || 'Autosave rejected'],
          context: { documentId: state.draft?.id },
        });
        dispatch({ type: 'AUTOSAVE_FAILED' });
      } catch (error) {
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'autosave_clinical_document',
          date: state.draft?.sourceDailyRecordDate,
          issues: [error instanceof Error ? error.message : 'Autosave failed'],
          context: { documentId: state.draft?.id },
        });
        dispatch({ type: 'AUTOSAVE_FAILED' });
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [canEdit, hospitalId, isActive, role, state.draft, user]);

  const validationIssues = useMemo(
    () => (state.draft ? validateClinicalDocument(state.draft) : []),
    [state.draft]
  );

  const setDraft = useCallback<Dispatch<SetStateAction<ClinicalDocumentRecord | null>>>(
    nextDraftOrUpdater => {
      const nextDraft =
        typeof nextDraftOrUpdater === 'function'
          ? nextDraftOrUpdater(draftRef.current)
          : nextDraftOrUpdater;
      const hydratedDraft = hydrateIncomingDocument(nextDraft);
      dispatch({
        type: 'LOAD_DOCUMENT',
        document: hydratedDraft,
        snapshot: serializeClinicalDocument(hydratedDraft),
      });
    },
    []
  );

  const setIsSaving = useCallback<Dispatch<SetStateAction<boolean>>>(
    nextValueOrUpdater => {
      const nextValue =
        typeof nextValueOrUpdater === 'function'
          ? nextValueOrUpdater(state.isSaving)
          : nextValueOrUpdater;
      dispatch({ type: 'SET_IS_SAVING', value: nextValue });
    },
    [state.isSaving]
  );

  return {
    draft: state.draft,
    hasPendingRemoteUpdate: state.hasPendingRemoteUpdate,
    hasLocalDraftChanges,
    applyPendingRemoteUpdate: () => dispatch({ type: 'APPLY_REMOTE_UPDATE' }),
    discardLocalDraftChanges: () => dispatch({ type: 'DISCARD_LOCAL_CHANGES' }),
    setDraft,
    isSaving: state.isSaving,
    setIsSaving,
    validationIssues,
    lastPersistedSnapshotRef,
    patchPatientField: (fieldId, value) => dispatch({ type: 'PATCH_FIELD', fieldId, value }),
    patchPatientFieldLabel: (fieldId, label) =>
      dispatch({ type: 'PATCH_FIELD_LABEL', fieldId, label }),
    setPatientFieldVisibility: (fieldId, visible) =>
      dispatch({ type: 'SET_FIELD_VISIBILITY', fieldId, visible }),
    patchSection: (sectionId, content) => dispatch({ type: 'PATCH_SECTION', sectionId, content }),
    appendSectionText: (sectionId, text) =>
      dispatch({ type: 'APPEND_SECTION_TEXT', sectionId, text }),
    patchSectionTitle: (sectionId, title) =>
      dispatch({ type: 'PATCH_SECTION_TITLE', sectionId, title }),
    setSectionVisibility: (sectionId, visible) =>
      dispatch({ type: 'SET_SECTION_VISIBILITY', sectionId, visible }),
    moveSection: (sectionId, direction) => dispatch({ type: 'MOVE_SECTION', sectionId, direction }),
    reorderSection: (sourceSectionId, targetSectionId) =>
      dispatch({ type: 'REORDER_SECTION', sourceSectionId, targetSectionId }),
    patchDocumentTitle: title => dispatch({ type: 'PATCH_DOCUMENT_TITLE', title }),
    patchPatientInfoTitle: title => dispatch({ type: 'PATCH_PATIENT_INFO_TITLE', title }),
    patchFooterLabel: (kind, title) => dispatch({ type: 'PATCH_FOOTER_LABEL', kind, title }),
    patchDocumentMeta: patch => dispatch({ type: 'PATCH_DOCUMENT_META', patch }),
    resetDocumentContent: () => dispatch({ type: 'RESET_DOCUMENT_CONTENT' }),
  };
};
