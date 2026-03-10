import React from 'react';
import { Eye } from 'lucide-react';

import { ClinicalDocumentFormattingToolbar } from '@/features/clinical-documents/components/ClinicalDocumentFormattingToolbar';
import { ClinicalDocumentFooterSection } from '@/features/clinical-documents/components/ClinicalDocumentFooterSection';
import { ClinicalDocumentPatientInfoSection } from '@/features/clinical-documents/components/ClinicalDocumentPatientInfoSection';
import { ClinicalDocumentSectionList } from '@/features/clinical-documents/components/ClinicalDocumentSectionList';
import { ClinicalDocumentSheetHeader } from '@/features/clinical-documents/components/ClinicalDocumentSheetHeader';
import type { ClinicalDocumentSheetProps } from '@/features/clinical-documents/components/clinicalDocumentSheetShared';
import { useClinicalDocumentSheetState } from '@/features/clinical-documents/hooks/useClinicalDocumentSheetState';

export const ClinicalDocumentSheet: React.FC<ClinicalDocumentSheetProps> = ({
  selectedDocument,
  hasPendingRemoteUpdate = false,
  hasLocalDraftChanges = false,
  onApplyPendingRemoteUpdate,
  onDiscardLocalDraftChanges,
  canEdit,
  canUnsignSelectedDocument,
  role,
  isSaving,
  isUploadingPdf,
  onSave,
  onSign,
  onUnsign,
  onPrint,
  onUploadPdf,
  onResetDocumentContent,
  patchDocumentTitle,
  patchPatientInfoTitle,
  patchPatientField,
  patchPatientFieldLabel,
  setPatientFieldVisibility,
  patchSectionTitle,
  patchSection,
  setSectionVisibility,
  moveSection,
  reorderSection,
  patchFooterLabel,
  patchDocumentMeta,
  indicationsCatalog,
  isSavingCustomIndication,
  customIndicationError,
  addCustomIndication,
  updateIndication,
  deleteIndication,
  importIndicationsCatalog,
}) => {
  const sheetState = useClinicalDocumentSheetState(selectedDocument);

  if (!selectedDocument) {
    return (
      <div className="mx-auto max-w-4xl rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-500">
        Selecciona o crea un documento clínico para comenzar.
      </div>
    );
  }

  const visiblePatientFields = selectedDocument.patientFields.filter(
    field => field.visible !== false
  );
  const hiddenPatientFields = selectedDocument.patientFields.filter(
    field => field.visible === false
  );
  const visibleSections = selectedDocument.sections
    .filter(section => section.visible !== false)
    .sort((left, right) => left.order - right.order);
  const hiddenSections = selectedDocument.sections.filter(section => section.visible === false);

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <ClinicalDocumentFormattingToolbar
        selectedDocument={selectedDocument}
        hasPendingRemoteUpdate={hasPendingRemoteUpdate}
        hasLocalDraftChanges={hasLocalDraftChanges}
        canEdit={canEdit}
        canUnsignSelectedDocument={canUnsignSelectedDocument}
        role={role}
        isSaving={isSaving}
        isUploadingPdf={isUploadingPdf}
        formattingDisabled={sheetState.formattingDisabled || !canEdit}
        isFormattingOpen={sheetState.isFormattingOpen}
        activeEditorHistoryState={sheetState.activeEditorHistoryState}
        onApplyPendingRemoteUpdate={onApplyPendingRemoteUpdate}
        onDiscardLocalDraftChanges={onDiscardLocalDraftChanges}
        onSign={onSign}
        onUnsign={onUnsign}
        onPrint={onPrint}
        onUploadPdf={onUploadPdf}
        onResetDocumentContent={onResetDocumentContent}
        onToggleFormatting={() => sheetState.setIsFormattingOpen(prev => !prev)}
        onApplyFormatting={sheetState.applyFormatting}
      />

      <div id="clinical-document-sheet" className="clinical-document-sheet">
        <ClinicalDocumentSheetHeader
          title={selectedDocument.title}
          canEdit={canEdit}
          isLocked={selectedDocument.isLocked}
          onChangeTitle={patchDocumentTitle}
        />

        {(hiddenPatientFields.length > 0 || hiddenSections.length > 0) && (
          <div className="clinical-document-restore-panel">
            {hiddenPatientFields.map(field => (
              <button
                key={field.id}
                type="button"
                className="clinical-document-restore-chip"
                onClick={() => setPatientFieldVisibility(field.id, true)}
                disabled={!canEdit || selectedDocument.isLocked}
              >
                <Eye size={12} />
                Restaurar campo: {field.label || field.id}
              </button>
            ))}
            {hiddenSections.map(section => (
              <button
                key={section.id}
                type="button"
                className="clinical-document-restore-chip"
                onClick={() => setSectionVisibility(section.id, true)}
                disabled={!canEdit || selectedDocument.isLocked}
              >
                <Eye size={12} />
                Restaurar sección: {section.title || section.id}
              </button>
            ))}
          </div>
        )}

        <ClinicalDocumentPatientInfoSection
          document={selectedDocument}
          visiblePatientFields={visiblePatientFields}
          canEdit={canEdit}
          activeTitleTarget={sheetState.activeTitleTarget}
          onSetActiveTitleTarget={sheetState.setActiveTitleTarget}
          onPatchPatientInfoTitle={patchPatientInfoTitle}
          onPatchPatientFieldLabel={patchPatientFieldLabel}
          onPatchPatientField={patchPatientField}
          onSetPatientFieldVisibility={setPatientFieldVisibility}
        />

        <ClinicalDocumentSectionList
          document={selectedDocument}
          visibleSections={visibleSections}
          canEdit={canEdit}
          activeTitleTarget={sheetState.activeTitleTarget}
          draggedSectionId={sheetState.draggedSectionId}
          dragOverSectionId={sheetState.dragOverSectionId}
          activePlanSubsectionId={sheetState.activePlanSubsectionId}
          activeIndicationsSpecialtyId={sheetState.activeIndicationsSpecialtyId}
          isIndicationsPanelOpen={sheetState.isIndicationsPanelOpen}
          indicationsCatalog={indicationsCatalog}
          isSavingCustomIndication={isSavingCustomIndication}
          customIndicationError={customIndicationError}
          onSetActiveTitleTarget={sheetState.setActiveTitleTarget}
          onPatchSectionTitle={patchSectionTitle}
          onPatchSection={patchSection}
          onSetSectionVisibility={setSectionVisibility}
          onMoveSection={moveSection}
          onReorderSection={reorderSection}
          onEditorActivate={sheetState.handleEditorActivate}
          onEditorDeactivate={sheetState.handleEditorDeactivate}
          onSetActivePlanSubsectionId={sheetState.setActivePlanSubsectionId}
          onSetActiveIndicationsSpecialtyId={sheetState.setActiveIndicationsSpecialtyId}
          onToggleIndicationsPanel={() => sheetState.setIsIndicationsPanelOpen(prev => !prev)}
          onAddCustomIndication={addCustomIndication}
          onUpdateIndication={updateIndication}
          onDeleteIndication={deleteIndication}
          onImportIndicationsCatalog={importIndicationsCatalog}
          dragHandlers={sheetState.sectionDragHandlers}
        />

        <ClinicalDocumentFooterSection
          document={selectedDocument}
          canEdit={canEdit}
          onPatchFooterLabel={patchFooterLabel}
          onPatchDocumentMeta={patchDocumentMeta}
          onClearActiveTitleTarget={() => sheetState.setActiveTitleTarget(null)}
        />
      </div>
    </div>
  );
};
