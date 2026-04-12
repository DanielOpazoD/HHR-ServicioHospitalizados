import React, { useCallback } from 'react';
import { createPortal } from 'react-dom';

import '@/features/clinical-documents/styles/clinicalDocumentSheet.css';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import { ClinicalDocumentFormattingToolbar } from '@/features/clinical-documents/components/ClinicalDocumentFormattingToolbar';
import { ClinicalDocumentStatusBar } from '@/features/clinical-documents/components/ClinicalDocumentStatusBar';
import { ClinicalDocumentsSidebar } from '@/features/clinical-documents/components/ClinicalDocumentsSidebar';
import { ClinicalDocumentSheet } from '@/features/clinical-documents/components/ClinicalDocumentSheet';
import { useClinicalDocumentsWorkspaceModel } from '@/features/clinical-documents/hooks/useClinicalDocumentsWorkspaceModel';
import { useClinicalDocumentSheetState } from '@/features/clinical-documents/hooks/useClinicalDocumentSheetState';

interface ClinicalDocumentsWorkspaceProps {
  patient: PatientData;
  currentDateString: string;
  bedId: string;
  isActive?: boolean;
  headerActionsContainerId?: string;
}

export const ClinicalDocumentsWorkspace: React.FC<ClinicalDocumentsWorkspaceProps> = ({
  patient,
  currentDateString,
  bedId,
  isActive = true,
  headerActionsContainerId,
}) => {
  const { canRead, sidebarProps, sheetProps } = useClinicalDocumentsWorkspaceModel({
    patient,
    currentDateString,
    bedId,
    isActive,
  });
  const sheetState = useClinicalDocumentSheetState(sheetProps.selectedDocument);

  const handleInsertLabText = useCallback(
    (text: string) => {
      const doc = sheetProps.selectedDocument;
      if (!doc || !sheetProps.patchSection) return;
      const firstSection = doc.sections?.find(s => s.visible !== false);
      if (!firstSection) return;
      const existing = firstSection.content || '';
      const separator = existing.trim() ? '<br>' : '';
      sheetProps.patchSection(firstSection.id, existing + separator + text);
    },
    [sheetProps]
  );

  if (!canRead) {
    return (
      <p className="p-4 text-sm text-slate-600">No tienes permisos para acceder a este módulo.</p>
    );
  }

  // Status bar (autosave + Drive) → portaled to modal header
  const statusNode = sheetProps.selectedDocument ? (
    <ClinicalDocumentStatusBar
      isSaving={sheetProps.isSaving}
      lastSavedAt={sheetProps.lastSavedAt}
      isUploadingPdf={sheetProps.isUploadingPdf}
      driveExported={sheetProps.selectedDocument.pdf?.exportStatus === 'exported'}
      onUploadPdf={sheetProps.onUploadPdf}
    />
  ) : null;

  // Editing toolbar (lab, PDF, format, restore)
  const toolbarNode = sheetProps.selectedDocument ? (
    <ClinicalDocumentFormattingToolbar
      selectedDocument={sheetProps.selectedDocument}
      canEdit={sheetProps.canEdit}
      formattingDisabled={sheetState.formattingDisabled || !sheetProps.canEdit}
      isFormattingOpen={sheetState.isFormattingOpen}
      onPrint={sheetProps.onPrint}
      onRestoreTemplate={sheetProps.onRestoreTemplate}
      onToggleFormatting={() => sheetState.setIsFormattingOpen(prev => !prev)}
      onApplyFormatting={sheetState.applyFormatting}
      patientRut={patient.rut}
      onInsertLabText={sheetProps.canEdit ? handleInsertLabText : undefined}
    />
  ) : null;

  const headerActionsContainer = headerActionsContainerId
    ? document.getElementById(headerActionsContainerId)
    : null;

  const headerContent =
    statusNode || toolbarNode ? (
      <div className="flex items-center gap-3">
        {statusNode}
        {statusNode && toolbarNode && <div className="h-4 w-px bg-slate-200/70" />}
        {toolbarNode}
      </div>
    ) : null;

  return (
    <div
      className="grid h-[82vh] min-h-[82vh] grid-cols-[260px_minmax(0,1fr)]"
      data-testid="clinical-documents-workspace"
    >
      {headerContent && headerActionsContainer
        ? createPortal(headerContent, headerActionsContainer)
        : null}
      <ClinicalDocumentsSidebar {...sidebarProps} />

      <section className="relative overflow-y-auto overflow-x-hidden bg-[#f3f4f6] p-3">
        <ClinicalDocumentSheet
          {...sheetProps}
          toolbar={headerContent && !headerActionsContainer ? headerContent : null}
          activeTitleTarget={sheetState.activeTitleTarget}
          onSetActiveTitleTarget={sheetState.setActiveTitleTarget}
          draggedSectionId={sheetState.draggedSectionId}
          dragOverSectionId={sheetState.dragOverSectionId}
          activePlanSubsectionId={sheetState.activePlanSubsectionId}
          activeIndicationsSpecialtyId={sheetState.activeIndicationsSpecialtyId}
          isIndicationsPanelOpen={sheetState.isIndicationsPanelOpen}
          onSetActivePlanSubsectionId={sheetState.setActivePlanSubsectionId}
          onSetActiveIndicationsSpecialtyId={sheetState.setActiveIndicationsSpecialtyId}
          onToggleIndicationsPanel={() => sheetState.setIsIndicationsPanelOpen(prev => !prev)}
          onEditorActivate={sheetState.handleEditorActivate}
          onEditorDeactivate={sheetState.handleEditorDeactivate}
          dragHandlers={sheetState.sectionDragHandlers}
        />
      </section>
    </div>
  );
};
