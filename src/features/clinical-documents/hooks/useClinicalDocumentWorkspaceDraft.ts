import { useEffect, useMemo, useRef, useState } from 'react';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { validateClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentValidationController';
import {
  buildClinicalDocumentActor,
  hydrateLegacyClinicalDocument,
  serializeClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { normalizeClinicalDocumentContentForStorage } from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';
import { executePersistClinicalDocumentDraft } from '@/application/clinical-documents/clinicalDocumentUseCases';
import {
  recordOperationalOutcome,
  recordOperationalTelemetry,
} from '@/services/observability/operationalTelemetryService';

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
  patchPatientFieldLabel: (fieldId: string, label: string) => void;
  setPatientFieldVisibility: (fieldId: string, visible: boolean) => void;
  patchSection: (sectionId: string, content: string) => void;
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
        recordOperationalOutcome('clinical_document', 'autosave_clinical_document', result, {
          date: draft.sourceDailyRecordDate,
          context: { documentId: draft.id },
        });
        if (result.status === 'success' && result.data) {
          lastPersistedSnapshotRef.current = serializeClinicalDocument(result.data);
          setDraft(result.data);
        } else {
          console.error('[ClinicalDocumentsWorkspace] Autosave failed', result.issues[0]?.message);
        }
      } catch (error) {
        console.error('[ClinicalDocumentsWorkspace] Autosave failed', error);
        recordOperationalTelemetry({
          category: 'clinical_document',
          status: 'failed',
          operation: 'autosave_clinical_document',
          date: draft.sourceDailyRecordDate,
          issues: [error instanceof Error ? error.message : 'Autosave failed'],
          context: { documentId: draft.id },
        });
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
              section.id === sectionId
                ? { ...section, content: normalizeClinicalDocumentContentForStorage(content) }
                : section
            ),
          }
        : prev
    );
  };

  const patchPatientFieldLabel = (fieldId: string, label: string) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            patientFields: prev.patientFields.map(field =>
              field.id === fieldId ? { ...field, label } : field
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

  const setPatientFieldVisibility = (fieldId: string, visible: boolean) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            patientFields: prev.patientFields.map(field =>
              field.id === fieldId ? { ...field, visible } : field
            ),
          }
        : prev
    );
  };

  const setSectionVisibility = (sectionId: string, visible: boolean) => {
    setDraft(prev =>
      prev
        ? {
            ...prev,
            sections: prev.sections.map(section =>
              section.id === sectionId ? { ...section, visible } : section
            ),
          }
        : prev
    );
  };

  const reorderSection = (sourceSectionId: string, targetSectionId: string) => {
    setDraft(prev => {
      if (!prev || sourceSectionId === targetSectionId) return prev;

      const orderedSections = [...prev.sections].sort((left, right) => left.order - right.order);
      const visibleSections = orderedSections.filter(section => section.visible !== false);
      const hiddenSections = orderedSections.filter(section => section.visible === false);
      const sourceIndex = visibleSections.findIndex(section => section.id === sourceSectionId);
      const targetIndex = visibleSections.findIndex(section => section.id === targetSectionId);

      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const reorderedVisibleSections = [...visibleSections];
      const [movedSection] = reorderedVisibleSections.splice(sourceIndex, 1);
      reorderedVisibleSections.splice(targetIndex, 0, movedSection);

      const nextVisibleSections = reorderedVisibleSections.map((section, index) => ({
        ...section,
        order: index,
      }));
      const nextHiddenSections = hiddenSections.map((section, index) => ({
        ...section,
        order: nextVisibleSections.length + index,
      }));
      const nextSectionMap = new Map(
        [...nextVisibleSections, ...nextHiddenSections].map(section => [section.id, section])
      );

      return {
        ...prev,
        sections: prev.sections
          .map(section => nextSectionMap.get(section.id) || section)
          .sort((left, right) => left.order - right.order),
      };
    });
  };

  const moveSection = (sectionId: string, direction: 'up' | 'down') => {
    setDraft(prev => {
      if (!prev) return prev;

      const visibleOrdered = [...prev.sections]
        .filter(section => section.visible !== false)
        .sort((left, right) => left.order - right.order);
      const currentVisibleIndex = visibleOrdered.findIndex(section => section.id === sectionId);
      if (currentVisibleIndex === -1) return prev;

      const targetVisibleIndex =
        direction === 'up' ? currentVisibleIndex - 1 : currentVisibleIndex + 1;
      if (targetVisibleIndex < 0 || targetVisibleIndex >= visibleOrdered.length) {
        return prev;
      }

      const targetSection = visibleOrdered[targetVisibleIndex];
      if (!targetSection) return prev;

      const orderedSections = [...prev.sections].sort((left, right) => left.order - right.order);
      const hiddenSections = orderedSections.filter(section => section.visible === false);
      const reorderedVisibleSections = [...visibleOrdered];
      const [movedSection] = reorderedVisibleSections.splice(currentVisibleIndex, 1);
      reorderedVisibleSections.splice(targetVisibleIndex, 0, movedSection);

      const nextVisibleSections = reorderedVisibleSections.map((section, index) => ({
        ...section,
        order: index,
      }));
      const nextHiddenSections = hiddenSections.map((section, index) => ({
        ...section,
        order: nextVisibleSections.length + index,
      }));
      const nextSectionMap = new Map(
        [...nextVisibleSections, ...nextHiddenSections].map(section => [section.id, section])
      );

      return {
        ...prev,
        sections: prev.sections
          .map(section => nextSectionMap.get(section.id) || section)
          .sort((left, right) => left.order - right.order),
      };
    });
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
    patchPatientFieldLabel,
    setPatientFieldVisibility,
    patchSection,
    patchSectionTitle,
    setSectionVisibility,
    moveSection,
    reorderSection,
    patchDocumentTitle,
    patchPatientInfoTitle,
    patchFooterLabel,
    patchDocumentMeta,
  };
};
