import React, { useCallback, useState } from 'react';
import { createPortal } from 'react-dom';

import '@/features/clinical-documents/styles/clinicalDocumentSheet.css';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import { ClinicalDocumentFormattingToolbar } from '@/features/clinical-documents/components/ClinicalDocumentFormattingToolbar';
import { ClinicalDocumentStatusBar } from '@/features/clinical-documents/components/ClinicalDocumentStatusBar';
import { ClinicalDocumentsSidebar } from '@/features/clinical-documents/components/ClinicalDocumentsSidebar';
import { ClinicalDocumentSheet } from '@/features/clinical-documents/components/ClinicalDocumentSheet';
import { ClinicalDocumentLabInsertDialog } from '@/features/clinical-documents/components/ClinicalDocumentLabInsertDialog';
import { ClinicalDocumentMMRADCopyDialog } from '@/features/clinical-documents/components/ClinicalDocumentMMRADCopyDialog';
import { useClinicalDocumentsWorkspaceModel } from '@/features/clinical-documents/hooks/useClinicalDocumentsWorkspaceModel';
import { useClinicalDocumentSheetState } from '@/features/clinical-documents/hooks/useClinicalDocumentSheetState';

const ZOOM_STEP = 10;
const ZOOM_MIN = 60;
const ZOOM_MAX = 150;
const ZOOM_DEFAULT = 110;

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
  const [zoom, setZoom] = useState(ZOOM_DEFAULT);
  const [showLabDialog, setShowLabDialog] = useState(false);
  const [showMMRADDialog, setShowMMRADDialog] = useState(false);

  const handleInsertLabText = useCallback(
    (text: string) => {
      const doc = sheetProps.selectedDocument;
      if (!doc || !sheetProps.patchSection) return;
      const firstSection = doc.sections?.find(s => s.visible !== false);
      if (!firstSection) return;
      const existing = firstSection.content || '';
      const separator = existing.trim() ? '<br>' : '';
      sheetProps.patchSection(firstSection.id, existing + separator + text);
      setShowLabDialog(false);
    },
    [sheetProps]
  );

  if (!canRead) {
    return (
      <p className="p-4 text-sm text-slate-600">No tienes permisos para acceder a este módulo.</p>
    );
  }

  const toolbarNode = sheetProps.selectedDocument ? (
    <ClinicalDocumentFormattingToolbar
      selectedDocument={sheetProps.selectedDocument}
      canEdit={sheetProps.canEdit}
      formattingDisabled={sheetState.formattingDisabled || !sheetProps.canEdit}
      isFormattingOpen={sheetState.isFormattingOpen}
      canUndo={sheetState.activeEditorHistoryState.canUndo}
      canRedo={sheetState.activeEditorHistoryState.canRedo}
      onPrint={sheetProps.onPrint}
      onRestoreTemplate={sheetProps.onRestoreTemplate}
      onToggleFormatting={() => sheetState.setIsFormattingOpen(prev => !prev)}
      onApplyFormatting={sheetState.applyFormatting}
      onInsertHtml={sheetState.insertHtml}
      zoom={zoom}
      onZoomIn={() => setZoom(z => Math.min(ZOOM_MAX, z + ZOOM_STEP))}
      onZoomOut={() => setZoom(z => Math.max(ZOOM_MIN, z - ZOOM_STEP))}
    />
  ) : null;

  const statusNode = sheetProps.selectedDocument ? (
    <ClinicalDocumentStatusBar
      isSaving={sheetProps.isSaving}
      lastSavedAt={sheetProps.lastSavedAt}
      isUploadingPdf={sheetProps.isUploadingPdf}
      driveExported={sheetProps.selectedDocument.pdf?.exportStatus === 'exported'}
      onUploadPdf={sheetProps.onUploadPdf}
    />
  ) : null;

  const headerActionsContainer = headerActionsContainerId
    ? document.getElementById(headerActionsContainerId)
    : null;

  // Toolbar uses fixed centering over the full modal width.
  // Status stays in normal flow (right-aligned in headerActions).
  const headerContent =
    toolbarNode || statusNode ? (
      <>
        {toolbarNode && (
          <div className="fixed left-1/2 -translate-x-1/2 z-20 flex items-center">
            {toolbarNode}
          </div>
        )}
        {statusNode && <div className="flex items-center">{statusNode}</div>}
      </>
    ) : null;

  return (
    <div
      className="relative grid h-[86vh] min-h-[86vh] grid-cols-[260px_minmax(0,1fr)]"
      data-testid="clinical-documents-workspace"
      data-module="clinical-documents"
    >
      {headerContent && headerActionsContainer
        ? createPortal(headerContent, headerActionsContainer)
        : null}
      <ClinicalDocumentsSidebar
        {...sidebarProps}
        onOpenLabDialog={
          patient.rut && sheetProps.canEdit && sheetProps.selectedDocument
            ? () => {
                setShowMMRADDialog(false);
                setShowLabDialog(true);
              }
            : undefined
        }
        onOpenMMRADDialog={
          patient.rut && sheetProps.canEdit && sheetProps.selectedDocument
            ? () => {
                setShowLabDialog(false);
                setShowMMRADDialog(true);
              }
            : undefined
        }
      />

      <section className="relative overflow-y-auto overflow-x-hidden bg-[#f3f4f6] p-3">
        <div style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}>
          <ClinicalDocumentSheet
            {...sheetProps}
            toolbar={headerContent && !headerActionsContainer ? headerContent : null}
            activeTitleTarget={sheetState.activeTitleTarget}
            activeEditorSectionId={sheetState.activeEditorSectionId}
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
        </div>
      </section>

      {showLabDialog && patient.rut && (
        <ClinicalDocumentLabInsertDialog
          patientRut={patient.rut}
          onInsert={handleInsertLabText}
          onClose={() => setShowLabDialog(false)}
        />
      )}
      {showMMRADDialog && patient.rut && (
        <ClinicalDocumentMMRADCopyDialog
          patientRut={patient.rut}
          onClose={() => setShowMMRADDialog(false)}
        />
      )}
    </div>
  );
};
