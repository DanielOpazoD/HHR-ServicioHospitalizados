import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/UIContext';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import {
  canDeleteClinicalDocuments,
  canEditClinicalDocuments,
  canReadClinicalDocuments,
  canUnsignClinicalDocument,
} from '@/features/clinical-documents/controllers/clinicalDocumentPermissionController';
import { buildClinicalDocumentWorkspaceNotifyPort } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import type { ClinicalDocumentSheetProps } from '@/features/clinical-documents/components/clinicalDocumentSheetShared';
import type { ClinicalDocumentsSidebarProps } from '@/features/clinical-documents/contracts/clinicalDocumentsSidebarContracts';
import { useClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/hooks/useClinicalDocumentIndicationsCatalog';
import { useClinicalDocumentWorkspaceBootstrap } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceBootstrap';
import { useClinicalDocumentWorkspaceDraft } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDraft';
import { useClinicalDocumentWorkspaceDocumentActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDocumentActions';
import { useClinicalDocumentWorkspaceExportActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceExportActions';

interface UseClinicalDocumentsWorkspaceModelParams {
  patient: PatientData;
  currentDateString: string;
  bedId: string;
  isActive: boolean;
}

interface ClinicalDocumentsWorkspaceModel {
  canRead: boolean;
  sidebarProps: ClinicalDocumentsSidebarProps;
  sheetProps: ClinicalDocumentSheetProps;
}

export const useClinicalDocumentsWorkspaceModel = ({
  patient,
  currentDateString,
  bedId,
  isActive,
}: UseClinicalDocumentsWorkspaceModelParams): ClinicalDocumentsWorkspaceModel => {
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

  const { createDocument, handleDeleteDocument, handleSign, handleUnsign } =
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

  return {
    canRead,
    sidebarProps: {
      canEdit,
      canDelete,
      patientName: patient.patientName,
      templates,
      selectedTemplateId,
      onSelectTemplate: setSelectedTemplateId,
      onCreateDocument: () => void createDocument(),
      documents,
      selectedDocumentId,
      onSelectDocument: setSelectedDocumentId,
      onDeleteDocument: document => void handleDeleteDocument(document),
    },
    sheetProps: {
      selectedDocument,
      canEdit,
      canUnsignSelectedDocument: Boolean(canUnsignSelectedDocument),
      role,
      isSaving,
      isUploadingPdf,
      validationIssues,
      onSign: handleSign,
      onUnsign: () => void handleUnsign(),
      onPrint: handlePrint,
      onUploadPdf: () => void handleUploadPdf(),
      onResetDocumentContent: () => void handleResetDocumentContent(),
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
      importIndicationsCatalog: importCatalog,
    },
  };
};
