import React from 'react';

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
      notify: buildClinicalDocumentWorkspaceNotifyPort(
        success,
        warning,
        notifyError,
        info,
        confirm
      ),
      setSelectedDocumentId,
      setDraft,
      setIsSaving,
      lastPersistedSnapshotRef,
    });

  const { handlePrint, handleUploadPdf, isUploadingPdf } =
    useClinicalDocumentWorkspaceExportActions({
      selectedDocument,
      hospitalId,
      notify: buildClinicalDocumentWorkspaceNotifyPort(
        success,
        warning,
        notifyError,
        info,
        confirm
      ),
      setDraft,
    });

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
          onUploadPdf={handleUploadPdf}
          patchDocumentTitle={patchDocumentTitle}
          patchPatientInfoTitle={patchPatientInfoTitle}
          patchPatientField={patchPatientField}
          patchSectionTitle={patchSectionTitle}
          patchSection={patchSection}
          patchFooterLabel={patchFooterLabel}
          patchDocumentMeta={patchDocumentMeta}
        />
      </section>
    </div>
  );
};
