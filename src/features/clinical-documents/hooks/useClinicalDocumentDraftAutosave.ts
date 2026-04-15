import { useEffect, useRef } from 'react';
import type { Dispatch, MutableRefObject } from 'react';

import {
  executePersistClinicalDocumentEditorDraft,
  resolveClinicalDocumentAutosaveCommit,
} from '@/application/clinical-documents/clinicalDocumentEditorUseCases';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';
import { serializeClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import type { ClinicalDocumentDraftAction } from '@/features/clinical-documents/hooks/clinicalDocumentDraftReducer';

interface UseClinicalDocumentDraftAutosaveParams {
  draft: ClinicalDocumentRecord | null;
  canEdit: boolean;
  isActive: boolean;
  hospitalId: string;
  role: string;
  persistReason: 'autosave' | 'admin_fix';
  user: {
    uid?: string;
    email?: string | null;
    displayName?: string | null;
  } | null;
  dispatch: Dispatch<ClinicalDocumentDraftAction>;
  draftRef: MutableRefObject<ClinicalDocumentRecord | null>;
  lastPersistedSnapshotRef: MutableRefObject<string>;
}

const AUTOSAVE_DELAY_MS = 900;

export const useClinicalDocumentDraftAutosave = ({
  draft,
  canEdit,
  isActive,
  hospitalId,
  role,
  persistReason,
  user,
  dispatch,
  draftRef,
  lastPersistedSnapshotRef,
}: UseClinicalDocumentDraftAutosaveParams) => {
  const autosaveTimerRef = useRef<number | null>(null);
  const latestAutosaveRequestIdRef = useRef(0);

  useEffect(() => {
    if (!draft || !canEdit || draft.isLocked || !isActive || !user) {
      return;
    }

    const draftSnapshot = serializeClinicalDocument(draft);
    if (draftSnapshot === lastPersistedSnapshotRef.current) {
      return;
    }

    if (autosaveTimerRef.current) {
      window.clearTimeout(autosaveTimerRef.current);
    }

    autosaveTimerRef.current = window.setTimeout(async () => {
      const requestedSnapshot = draftSnapshot;
      latestAutosaveRequestIdRef.current += 1;
      const requestId = latestAutosaveRequestIdRef.current;
      dispatch({ type: 'AUTOSAVE_REQUESTED' });

      try {
        const result = await executePersistClinicalDocumentEditorDraft({
          record: draft,
          hospitalId,
          role,
          user,
          reason: persistReason,
        });

        recordOperationalOutcome('clinical_document', 'autosave_clinical_document', result, {
          date: draft.sourceDailyRecordDate,
          context: { documentId: draft.id },
        });

        if (requestId !== latestAutosaveRequestIdRef.current) {
          return;
        }

        if (result.status === 'success' && result.data) {
          const savedSnapshot = serializeClinicalDocument(result.data);
          const currentDraftSnapshot = serializeClinicalDocument(draftRef.current);
          const commitMode = resolveClinicalDocumentAutosaveCommit({
            requestedSnapshot,
            currentDraftSnapshot,
          });

          if (commitMode === 'mark_clean') {
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
          date: draft.sourceDailyRecordDate,
          issues: [result.issues[0]?.message || 'Autosave rejected'],
          context: { documentId: draft.id },
        });
        dispatch({ type: 'AUTOSAVE_FAILED' });
      } catch (error) {
        if (requestId !== latestAutosaveRequestIdRef.current) {
          return;
        }

        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'autosave_clinical_document',
          date: draft.sourceDailyRecordDate,
          issues: [error instanceof Error ? error.message : 'Autosave failed'],
          context: { documentId: draft.id },
        });
        dispatch({ type: 'AUTOSAVE_FAILED' });
      }
    }, AUTOSAVE_DELAY_MS);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [
    canEdit,
    dispatch,
    draft,
    draftRef,
    hospitalId,
    isActive,
    lastPersistedSnapshotRef,
    role,
    persistReason,
    user,
  ]);
};
