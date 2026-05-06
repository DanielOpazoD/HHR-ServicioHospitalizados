import { useCallback, useMemo, useState } from 'react';

import { useAuth } from '@/context/AuthContext';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import type { ClinicalDocumentsSidebarProps } from '@/features/clinical-documents/contracts/clinicalDocumentsSidebarContracts';
import {
  buildClinicalDocumentsWorkspaceSheetProps,
  buildClinicalDocumentsWorkspaceSidebarProps,
  scrollToClinicalDocumentAnnex,
  type ClinicalDocumentsWorkspaceSheetModelProps,
} from '@/features/clinical-documents/controllers/clinicalDocumentsWorkspaceViewModel';
import { useClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/hooks/useClinicalDocumentIndicationsCatalog';
import { useClinicalDocumentWorkspaceBootstrap } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceBootstrap';
import { useClinicalDocumentWorkspaceDraft } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDraft';
import { useClinicalDocumentWorkspaceDocumentActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDocumentActions';
import { useClinicalDocumentWorkspaceExportActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceExportActions';
import { useClinicalDocumentsWorkspaceNotifyPort } from '@/features/clinical-documents/hooks/useClinicalDocumentsWorkspaceNotifyPort';
import {
  mergeDraftIntoClinicalDocumentsSidebar,
  resolveClinicalDocumentsWorkspaceAccessState,
} from './clinicalDocumentsWorkspaceModelSupport';

interface UseClinicalDocumentsWorkspaceModelParams {
  patient: PatientData;
  currentDateString: string;
  bedId: string;
  isActive: boolean;
}

type ClinicalDocumentsWorkspaceSheetProps = ClinicalDocumentsWorkspaceSheetModelProps;

interface ClinicalDocumentsWorkspaceModel {
  canRead: boolean;
  sidebarProps: ClinicalDocumentsSidebarProps;
  sheetProps: ClinicalDocumentsWorkspaceSheetProps;
}

export const useClinicalDocumentsWorkspaceModel = ({
  patient,
  currentDateString,
  bedId,
  isActive,
}: UseClinicalDocumentsWorkspaceModelParams): ClinicalDocumentsWorkspaceModel => {
  const { user, role } = useAuth();
  const { notifyPort, info, confirm } = useClinicalDocumentsWorkspaceNotifyPort();
  const [isImportingWithAi, setIsImportingWithAi] = useState(false);

  const { canRead, canEdit, canDelete, readOnlyMessage, persistReason } = useMemo(
    () => resolveClinicalDocumentsWorkspaceAccessState(patient, role),
    [patient, role]
  );
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
    hasLocalDraftChanges,
    setDraft,
    isSaving,
    lastSavedAt,
    validationIssues,
    lastPersistedSnapshotRef,
    flushPendingAutosave,
    patchPatientField,
    patchPatientFieldLabel,
    setPatientFieldVisibility,
    patchSection,
    patchSectionTitle,
    setSectionLayout,
    setSectionVisibility,
    moveSection,
    reorderSection,
    addSection,
    patchDocumentTitle,
    patchPatientInfoTitle,
    patchFooterLabel,
    patchDocumentMeta,
    restoreTemplateContent,
    addClinicalUpdate,
    patchAnnexContent,
    setAnnexIncludedInPrint,
    clearAnnexContent,
    patchIeehDraft,
    clearIeehDraft,
    patchUpdateDate,
    patchUpdateTime,
  } = useClinicalDocumentWorkspaceDraft({
    documents,
    selectedDocumentId,
    canEdit,
    isActive,
    hospitalId,
    role,
    persistReason,
    user,
  });

  const selectedDocument = draft;
  const sidebarDocuments = useMemo(
    () => mergeDraftIntoClinicalDocumentsSidebar(documents, draft),
    [documents, draft]
  );

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

  const {
    createDocument,
    handleDeleteDocument,
    handleDuplicateDocument,
    handleImportJson,
    handleImportWithAi,
  } = useClinicalDocumentWorkspaceDocumentActions({
    patient,
    role,
    user,
    hospitalId,
    episode,
    selectedTemplateId,
    templates,
    selectedDocumentId,
    canEdit,
    canDelete,
    notify: notifyPort,
    setSelectedDocumentId,
    setDraft,
    lastPersistedSnapshotRef,
  });

  const handleImportWithAiProgress = useCallback(
    async (file: File) => {
      if (isImportingWithAi) {
        return;
      }

      setIsImportingWithAi(true);
      try {
        await handleImportWithAi(file);
      } finally {
        setIsImportingWithAi(false);
      }
    },
    [handleImportWithAi, isImportingWithAi]
  );

  const { handleExportJson, handlePrint, handlePrintAnnex, handleUploadPdf, isUploadingPdf } =
    useClinicalDocumentWorkspaceExportActions({
      selectedDocument,
      hospitalId,
      notify: notifyPort,
      setDraft,
    });

  const scrollToAnnex = useCallback(() => {
    scrollToClinicalDocumentAnnex();
  }, []);

  return {
    canRead,
    sidebarProps: buildClinicalDocumentsWorkspaceSidebarProps({
      canEdit,
      canDelete,
      readOnlyMessage,
      patientName: patient.patientName,
      patientRut: patient.rut,
      templates,
      selectedTemplateId,
      selectedDocumentId,
      documents: sidebarDocuments,
      draft,
      setSelectedTemplateId,
      setSelectedDocumentId,
      createDocument,
      handleDuplicateDocument,
      handleDeleteDocument,
      handleExportJson,
      handleImportJson,
      handleImportWithAi: handleImportWithAiProgress,
      isImportingWithAi,
      addClinicalUpdate,
      patchAnnexContent,
      patchSectionTitle,
      patchSection,
      scrollToAnnex,
    }),
    sheetProps: buildClinicalDocumentsWorkspaceSheetProps({
      selectedDocument,
      canEdit,
      isSaving,
      lastSavedAt,
      hasLocalDraftChanges,
      flushPendingAutosave,
      isUploadingPdf,
      validationIssues,
      handlePrint,
      handleUploadPdf,
      draft,
      restoreTemplateContent,
      notifications: { info, confirm },
      patchDocumentTitle,
      patchPatientInfoTitle,
      patchPatientField,
      patchPatientFieldLabel,
      setPatientFieldVisibility,
      patchSectionTitle,
      patchSection,
      setSectionLayout,
      setSectionVisibility,
      moveSection,
      reorderSection,
      addSection,
      patchFooterLabel,
      patchDocumentMeta,
      indicationsCatalog,
      isSavingCustomIndication,
      customIndicationError,
      addCustomIndication,
      updateIndication,
      deleteIndication,
      importCatalog,
      addClinicalUpdate,
      patchAnnexContent,
      setAnnexIncludedInPrint,
      clearAnnexContent,
      handlePrintAnnex,
      patchIeehDraft,
      clearIeehDraft,
      workspacePatient: patient,
      patchUpdateDate,
      patchUpdateTime,
    }),
  };
};
