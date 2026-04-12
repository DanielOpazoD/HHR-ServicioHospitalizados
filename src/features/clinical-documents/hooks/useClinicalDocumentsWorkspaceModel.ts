import { useMemo } from 'react';

import { useAuth } from '@/context/AuthContext';
import { useNotification } from '@/context/UIContext';
import { getActiveHospitalId } from '@/constants/firestorePaths';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import { buildClinicalDocumentWorkspaceNotifyPort } from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import type { ClinicalDocumentSheetProps } from '@/features/clinical-documents/components/clinicalDocumentSheetShared';
import type { ClinicalDocumentsSidebarProps } from '@/features/clinical-documents/contracts/clinicalDocumentsSidebarContracts';
import { useClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/hooks/useClinicalDocumentIndicationsCatalog';
import { useClinicalDocumentWorkspaceBootstrap } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceBootstrap';
import { useClinicalDocumentWorkspaceDraft } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDraft';
import { useClinicalDocumentWorkspaceDocumentActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceDocumentActions';
import { useClinicalDocumentWorkspaceExportActions } from '@/features/clinical-documents/hooks/useClinicalDocumentWorkspaceExportActions';
import {
  buildRestoreClinicalDocumentTemplateConfirmOptions,
  canApplyClinicalDocumentTemplateSelection,
  mergeDraftIntoClinicalDocumentsSidebar,
  resolveClinicalDocumentsWorkspaceAccessState,
} from './clinicalDocumentsWorkspaceModelSupport';

interface UseClinicalDocumentsWorkspaceModelParams {
  patient: PatientData;
  currentDateString: string;
  bedId: string;
  isActive: boolean;
}

type ClinicalDocumentsWorkspaceSheetProps = Omit<
  ClinicalDocumentSheetProps,
  | 'toolbar'
  | 'activeTitleTarget'
  | 'onSetActiveTitleTarget'
  | 'draggedSectionId'
  | 'dragOverSectionId'
  | 'activePlanSubsectionId'
  | 'activeIndicationsSpecialtyId'
  | 'isIndicationsPanelOpen'
  | 'onSetActivePlanSubsectionId'
  | 'onSetActiveIndicationsSpecialtyId'
  | 'onToggleIndicationsPanel'
  | 'onEditorActivate'
  | 'onEditorDeactivate'
  | 'dragHandlers'
>;

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
  const { success, warning, error: notifyError, info, confirm } = useNotification();

  const { canRead, canEdit, canDelete, readOnlyMessage, persistReason } = useMemo(
    () => resolveClinicalDocumentsWorkspaceAccessState(patient, role),
    [patient, role]
  );
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
    lastSavedAt,
    validationIssues,
    lastPersistedSnapshotRef,
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
    applyTemplate,
    restoreTemplateContent,
    addClinicalUpdate,
    patchAnnexContent,
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

  const { createDocument, handleDeleteDocument } = useClinicalDocumentWorkspaceDocumentActions({
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

  const { handlePrint, handleUploadPdf, isUploadingPdf } =
    useClinicalDocumentWorkspaceExportActions({
      selectedDocument,
      hospitalId,
      notify: notifyPort,
      setDraft,
    });

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplateId(templateId);
    if (!canApplyClinicalDocumentTemplateSelection({ draft, canEdit })) {
      return;
    }
    applyTemplate(templateId);
  };

  const handleRestoreTemplate = async () => {
    if (!canApplyClinicalDocumentTemplateSelection({ draft, canEdit })) {
      return;
    }

    const confirmed = await confirm(buildRestoreClinicalDocumentTemplateConfirmOptions());

    if (!confirmed) {
      return;
    }

    restoreTemplateContent();
    info(
      'Plantilla reestablecida',
      'El documento volvió a su estructura base y quedó listo para seguir editando.'
    );
  };

  return {
    canRead,
    sidebarProps: {
      canEdit,
      canDelete,
      readOnlyMessage,
      patientName: patient.patientName,
      patientRut: patient.rut,
      templates,
      selectedTemplateId,
      onSelectTemplate: handleSelectTemplate,
      onCreateDocument: () => void createDocument(),
      documents: sidebarDocuments,
      selectedDocumentId,
      onSelectDocument: setSelectedDocumentId,
      onDeleteDocument: document => void handleDeleteDocument(document),
      onAddClinicalUpdate: canEdit ? addClinicalUpdate : undefined,
      onToggleAnnex: canEdit
        ? () => {
            const doc = draft;
            if (!doc) return;
            if (doc.annexContent == null) {
              patchAnnexContent('<br>');
            }
            setTimeout(() => {
              document
                .querySelector('.clinical-document-annex-page')
                ?.scrollIntoView({ behavior: 'smooth' });
            }, 100);
          }
        : undefined,
      hasAnnex: draft?.annexContent != null,
    },
    sheetProps: {
      selectedDocument,
      canEdit,
      isSaving,
      lastSavedAt,
      isUploadingPdf,
      validationIssues,
      onPrint: handlePrint,
      onUploadPdf: () => void handleUploadPdf(),
      onRestoreTemplate: () => void handleRestoreTemplate(),
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
      importIndicationsCatalog: importCatalog,
      addClinicalUpdate,
      patchAnnexContent,
      patchUpdateDate,
      patchUpdateTime,
    },
  };
};
