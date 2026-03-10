import React, { useMemo } from 'react';

import '@/features/clinical-documents/styles/clinicalDocumentSheet.css';
import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/UIContext';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type { PatientData } from '@/types';
import {
  canDeleteClinicalDocuments,
  canEditClinicalDocuments,
  canReadClinicalDocuments,
  canUnsignClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentPermissionController';
import { buildClinicalDocumentWorkspaceNotifyPort } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { ClinicalDocumentsSidebar } from '@/features/clinical-documents/components/ClinicalDocumentsSidebar';
import { ClinicalDocumentSheet } from '@/features/clinical-documents/components/ClinicalDocumentSheet';
import { useClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/hooks/useClinicalDocumentIndicationsCatalog';
import { useClinicalDocumentWorkspaceBootstrap } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceBootstrap';
import { useClinicalDocumentWorkspaceDraft } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDraft';
import { useClinicalDocumentWorkspaceDocumentActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDocumentActions';
import { useClinicalDocumentWorkspaceExportActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceExportActions';

interface ClinicalDocumentsWorkspaceProps {
  patient: PatientData;
  currentDateString: string;
  bedId: string;
  isActive?: boolean;
}

export const ClinicalDocumentsWorkspace: React.FC<ClinicalDocumentsWorkspaceProps> = ({
  patient,
  currentDateString,
  bedId,
  isActive = true,
}) => {
  const { user, role } = useAuth();
  const { success, warning, error: notifyError, info, confirm } = useNotification();

  const canRead = canReadClinicalDocuments(role);
  const canEdit = canEditClinicalDocuments(role);
  const canDelete = canDeleteClinicalDocuments(role);
  const hospitalId = getActiveHospitalId();
  const notifyPort = useMemo(
    () => buildClinicalDocumentWorkspaceNotifyPort(success, warning, notifyError, info, confirm),
    [confirm, info, notifyError, success, warning]
  );
  const {
    templates,
    selectedTemplateId,
    setSelectedTemplateId,
    documents,
    selectedDocumentId,
    setSelectedDocumentId,
    episode,
  } = useClinicalDocumentWorkspaceBootstrap({
    patient,
    currentDateString,
    bedId,
    isActive,
    canRead,
    hospitalId,
    role,
  });

  const {
    draft,
    hasPendingRemoteUpdate,
    hasLocalDraftChanges,
    applyPendingRemoteUpdate,
    discardLocalDraftChanges,
    setDraft,
    isSaving,
    setIsSaving,
    validationIssues,
    lastPersistedSnapshotRef,
    patchPatientField,
    patchPatientFieldLabel,
    setPatientFieldVisibility,
    patchSection,
    appendSectionText,
    patchSectionTitle,
    setSectionVisibility,
    moveSection,
    reorderSection,
    patchDocumentTitle,
    patchPatientInfoTitle,
    patchFooterLabel,
    patchDocumentMeta,
    resetDocumentContent,
  } = useClinicalDocumentWorkspaceDraft({
    documents,
    selectedDocumentId,
    canEdit,
    isActive,
    hospitalId,
    role,
    user,
  });

  const selectedDocument = draft;
  const canUnsignSelectedDocument =
    selectedDocument && user ? canUnsignClinicalDocument(role, selectedDocument) : false;
  const {
    indicationsCatalog,
    isSavingCustomIndication,
    customIndicationError,
    addCustomIndication,
    updateIndication,
    deleteIndication,
    importCatalog,
  } = useClinicalDocumentIndicationsCatalog({
    hospitalId,
    isActive,
    canEdit,
  });

  const { createDocument, handleDeleteDocument, handleSaveNow, handleSign, handleUnsign } =
    useClinicalDocumentWorkspaceDocumentActions({
      patient,
      role,
      user,
      hospitalId,
      episode,
      selectedTemplateId,
      templates,
      selectedDocument,
      selectedDocumentId,
      canEdit,
      canDelete,
      validationIssues,
      notify: notifyPort,
      setSelectedDocumentId,
      setDraft,
      setIsSaving,
      lastPersistedSnapshotRef,
    });

  const { handlePrint, handleUploadPdf, isUploadingPdf } =
    useClinicalDocumentWorkspaceExportActions({
      selectedDocument,
      hospitalId,
      notify: notifyPort,
      setDraft,
    });

  const handleResetDocumentContent = async () => {
    if (!draft || !canEdit || draft.isLocked) {
      return;
    }

    const confirmed = await confirm({
      title: 'Vaciar documento clínico',
      message:
        'Se limpiará el contenido clínico del documento actual y el borrador se volverá a guardar automáticamente.',
      confirmText: 'Vaciar',
      cancelText: 'Cancelar',
      variant: 'warning',
    });

    if (!confirmed) {
      return;
    }

    resetDocumentContent();
    info('Documento reiniciado', 'La planilla quedó en cero para seguir editando.');
  };

  if (!canRead) {
    return (
      <p className="p-4 text-sm text-slate-600">No tienes permisos para acceder a este módulo.</p>
    );
  }

  return (
    <div className="grid grid-cols-[260px_minmax(0,1fr)] min-h-[72vh]">
      <ClinicalDocumentsSidebar
        canEdit={canEdit}
        canDelete={canDelete}
        patientName={patient.patientName}
        templates={templates}
        selectedTemplateId={selectedTemplateId}
        onSelectTemplate={setSelectedTemplateId}
        onCreateDocument={() => void createDocument()}
        documents={documents}
        selectedDocumentId={selectedDocumentId}
        onSelectDocument={setSelectedDocumentId}
        onDeleteDocument={document => void handleDeleteDocument(document)}
      />

      <section className="bg-[#f3f4f6] p-3 overflow-y-auto">
        <ClinicalDocumentSheet
          selectedDocument={selectedDocument}
          hasPendingRemoteUpdate={hasPendingRemoteUpdate}
          hasLocalDraftChanges={hasLocalDraftChanges}
          onApplyPendingRemoteUpdate={applyPendingRemoteUpdate}
          onDiscardLocalDraftChanges={discardLocalDraftChanges}
          canEdit={canEdit}
          canUnsignSelectedDocument={Boolean(canUnsignSelectedDocument)}
          role={role}
          isSaving={isSaving}
          isUploadingPdf={isUploadingPdf}
          validationIssues={validationIssues}
          onSave={handleSaveNow}
          onSign={handleSign}
          onUnsign={() => void handleUnsign()}
          onPrint={handlePrint}
          onUploadPdf={() => void handleUploadPdf()}
          onResetDocumentContent={() => void handleResetDocumentContent()}
          patchDocumentTitle={patchDocumentTitle}
          patchPatientInfoTitle={patchPatientInfoTitle}
          patchPatientField={patchPatientField}
          patchPatientFieldLabel={patchPatientFieldLabel}
          setPatientFieldVisibility={setPatientFieldVisibility}
          patchSectionTitle={patchSectionTitle}
          patchSection={patchSection}
          appendSectionText={appendSectionText}
          setSectionVisibility={setSectionVisibility}
          moveSection={moveSection}
          reorderSection={reorderSection}
          patchFooterLabel={patchFooterLabel}
          patchDocumentMeta={patchDocumentMeta}
          indicationsCatalog={indicationsCatalog}
          isSavingCustomIndication={isSavingCustomIndication}
          customIndicationError={customIndicationError}
          addCustomIndication={addCustomIndication}
          updateIndication={updateIndication}
          deleteIndication={deleteIndication}
          importIndicationsCatalog={importCatalog}
        />
      </section>
    </div>
  );
};
