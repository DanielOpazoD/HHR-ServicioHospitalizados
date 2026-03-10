import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DragEvent } from 'react';

import type { ClinicalDocumentIndicationSpecialtyId } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import { resolveClinicalDocumentIndicationSpecialty } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import type { ClinicalDocumentPlanSubsectionId } from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';
import type {
  ClinicalDocumentFormattingCommand,
  ClinicalDocumentSheetEditorApi,
} from '@/features/clinical-documents/components/clinicalDocumentSheetShared';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

const DEFAULT_ACTIVE_SPECIALTY_ID: ClinicalDocumentIndicationSpecialtyId = 'tmt';

export const useClinicalDocumentSheetState = (selectedDocument: ClinicalDocumentRecord | null) => {
  const [activeTitleTarget, setActiveTitleTarget] = useState<string | null>(null);
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [isIndicationsPanelOpen, setIsIndicationsPanelOpen] = useState(false);
  const [activeIndicationsSpecialtyId, setActiveIndicationsSpecialtyId] =
    useState<ClinicalDocumentIndicationSpecialtyId>(DEFAULT_ACTIVE_SPECIALTY_ID);
  const [activePlanSubsectionId, setActivePlanSubsectionId] =
    useState<ClinicalDocumentPlanSubsectionId>('generales');
  const [activeEditorSectionId, setActiveEditorSectionId] = useState<string | null>(null);
  const [activeEditorHistoryState, setActiveEditorHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });

  const activeEditorSectionIdRef = useRef<string | null>(null);
  const activeEditorApiRef = useRef<ClinicalDocumentSheetEditorApi | null>(null);

  const clearActiveEditor = useCallback((sectionId: string) => {
    setActiveEditorSectionId(current => (current === sectionId ? null : current));
    if (activeEditorSectionIdRef.current === sectionId) {
      activeEditorApiRef.current = null;
      activeEditorSectionIdRef.current = null;
      setActiveEditorHistoryState({ canUndo: false, canRedo: false });
    }
  }, []);

  const handleEditorActivate = useCallback(
    (activeSectionId: string, editorApi: ClinicalDocumentSheetEditorApi) => {
      activeEditorApiRef.current = editorApi;
      activeEditorSectionIdRef.current = activeSectionId;
      setActiveEditorSectionId(current =>
        current === activeSectionId ? current : activeSectionId
      );
      setActiveEditorHistoryState(current =>
        current.canUndo === editorApi.canUndo && current.canRedo === editorApi.canRedo
          ? current
          : {
              canUndo: editorApi.canUndo,
              canRedo: editorApi.canRedo,
            }
      );
    },
    []
  );

  const handleEditorDeactivate = useCallback(
    (sectionId: string) => {
      clearActiveEditor(sectionId);
    },
    [clearActiveEditor]
  );

  useEffect(() => {
    if (!selectedDocument) {
      setIsIndicationsPanelOpen(false);
      return;
    }

    setActiveIndicationsSpecialtyId(
      resolveClinicalDocumentIndicationSpecialty(selectedDocument.especialidad)
    );
    setActivePlanSubsectionId('generales');
    setIsIndicationsPanelOpen(false);
  }, [selectedDocument?.especialidad, selectedDocument?.id]);

  const formattingDisabled =
    !selectedDocument || selectedDocument.isLocked || !activeEditorSectionId;

  const applyFormatting = useCallback(
    (command: ClinicalDocumentFormattingCommand, value?: string) => {
      if (formattingDisabled) return;
      activeEditorApiRef.current?.element?.focus();
      activeEditorApiRef.current?.applyCommand(command, value);
    },
    [formattingDisabled]
  );

  const insertIntoActiveEditor = useCallback(
    (text: string): boolean => {
      if (formattingDisabled || !text.trim()) {
        return false;
      }

      return activeEditorApiRef.current?.insertText(text) ?? false;
    },
    [formattingDisabled]
  );

  const sectionDragHandlers = useMemo(
    () => ({
      onDragStart: (event: DragEvent<HTMLButtonElement>, sectionId: string) => {
        if (event.dataTransfer) {
          event.dataTransfer.effectAllowed = 'move';
          event.dataTransfer.setData('text/plain', sectionId);
        }
        setDraggedSectionId(sectionId);
        setDragOverSectionId(null);
      },
      onDragOver: (event: DragEvent<HTMLElement>, sectionId: string, canInteract: boolean) => {
        if (!canInteract || !draggedSectionId) return;
        event.preventDefault();
        setDragOverSectionId(sectionId);
      },
      onDragLeave: (sectionId: string) => {
        if (dragOverSectionId === sectionId) {
          setDragOverSectionId(null);
        }
      },
      onDragEnd: () => {
        setDraggedSectionId(null);
        setDragOverSectionId(null);
      },
    }),
    [dragOverSectionId, draggedSectionId]
  );

  return {
    activeTitleTarget,
    setActiveTitleTarget,
    isFormattingOpen,
    setIsFormattingOpen,
    draggedSectionId,
    dragOverSectionId,
    setDragOverSectionId,
    setDraggedSectionId,
    isIndicationsPanelOpen,
    setIsIndicationsPanelOpen,
    activeIndicationsSpecialtyId,
    setActiveIndicationsSpecialtyId,
    activePlanSubsectionId,
    setActivePlanSubsectionId,
    activeEditorHistoryState,
    formattingDisabled,
    applyFormatting,
    insertIntoActiveEditor,
    handleEditorActivate,
    handleEditorDeactivate,
    sectionDragHandlers,
  };
};
