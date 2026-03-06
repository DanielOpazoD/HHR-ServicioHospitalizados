import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { validateClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentValidationController';
import {
  buildClinicalDocumentActor,
  hydrateLegacyClinicalDocument,
  serializeClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { executePersistClinicalDocumentDraft } from '@/application/clinical-documents/clinicalDocumentUseCases';

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
  setDraft: React.Dispatch<React.SetStateAction<ClinicalDocumentRecord | null>>;
  isSaving: boolean;
  setIsSaving: React.Dispatch<React.SetStateAction<boolean>>;
  validationIssues: Array<{ message: string }>;
  lastPersistedSnapshotRef: React.MutableRefObject<string>;
  patchPatientField: (fieldId: string, value: string) => void;
  patchSection: (sectionId: string, content: string) => void;
  patchSectionTitle: (sectionId: string, title: string) => void;
  patchDocumentTitle: (title: string) => void;
  patchPatientInfoTitle: (title: string) => void;
  patchFooterLabel: (kind: 'medico' | 'especialidad', title: string) => void;
  patchDocumentMeta: (
    patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>
  ) => void;
}

export const useClinicalDocumentWorkspaceDraft = ({
  documents,
  selectedDocumentId,
  canEdit,
  isActive,
  hospitalId,
  role,
  user,
}: UseClinicalDocumentWorkspaceDraftParams): ClinicalDocumentWorkspaceDraftState => {
  const [draft, setDraft] = useState<ClinicalDocumentRecord | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const autosaveTimerRef = useRef<number | null>(null);
  const lastPersistedSnapshotRef = useRef<string>('');

  useEffect(() => {
    if (!selectedDocumentId) {
      setDraft(null);
      lastPersistedSnapshotRef.current = '';
      return;
    }

    const selected = documents.find(document => document.id === selectedDocumentId) || null;
    const cloned = selected ? structuredClone(selected) : null;
    const hydratedClone = cloned ? hydrateLegacyClinicalDocument(cloned) : null;
    setDraft(hydratedClone);
    lastPersistedSnapshotRef.current = serializeClinicalDocument(hydratedClone);
  }, [documents, selectedDocumentId]);

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
      try {
        setIsSaving(true);
        const actor = buildClinicalDocumentActor(user, role);
        const result = await executePersistClinicalDocumentDraft(
          draft,
          hospitalId,
          actor,
          'autosave'
        );
        if (result.status === 'success' && result.data) {
          lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
          setDraft(result.data);
        } else {
          console.error('[ClinicalDocumentsWorkspace] Autosave failed', result.issues[0]?.message);
        }
      } catch (error) {
        console.error('[ClinicalDocumentsWorkspace] Autosave failed', error);
      } finally {
        setIsSaving(false);
      }
    }, 900);

    return () => {
      if (autosaveTimerRef.current) {
        window.clearTimeout(autosaveTimerRef.current);
        autosaveTimerRef.current = null;
      }
    };
  }, [canEdit, draft, hospitalId, isActive, role, user]);

  const validationIssues = useMemo(() => (draft ? validateClinicalDocument(draft) : []), [draft]);

  const patchPatientField = (fieldId: string, value: string) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            patientFields: prev.patientFields.map(field =>
              field.id === fieldId ? { ...field, value } : field
            ),
          }
        : prev
    );
  };

  const patchSection = (sectionId: string, content: string) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map(section =>
              section.id === sectionId ? { ...section, content } : section
            ),
          }
        : prev
    );
  };

  const patchSectionTitle = (sectionId: string, title: string) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map(section =>
              section.id === sectionId ? { ...section, title } : section
            ),
          }
        : prev
    );
  };

  const patchDocumentTitle = (title: string) => {
    setDraft(prev => (prev ? { ...prev, title } : prev));
  };

  const patchPatientInfoTitle = (title: string) => {
    setDraft(prev => (prev ? { ...prev, patientInfoTitle: title } : prev));
  };

  const patchFooterLabel = (kind: 'medico' | 'especialidad', title: string) => {
    setDraft(prev =>
      prev
        ? kind === 'medico'
          ? { ...prev, footerMedicoLabel: title }
          : { ...prev, footerEspecialidadLabel: title }
        : prev
    );
  };

  const patchDocumentMeta = (
    patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>
  ) => {
    setDraft(prev => (prev ? { ...prev, ...patch } : prev));
  };

  return {
    draft,
    setDraft,
    isSaving,
    setIsSaving,
    validationIssues,
    lastPersistedSnapshotRef,
    patchPatientField,
    patchSection,
    patchSectionTitle,
    patchDocumentTitle,
    patchPatientInfoTitle,
    patchFooterLabel,
    patchDocumentMeta,
  };
};
