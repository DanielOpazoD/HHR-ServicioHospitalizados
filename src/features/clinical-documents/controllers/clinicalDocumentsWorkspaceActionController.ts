import {
  buildRestoreClinicalDocumentTemplateConfirmOptions,
  canApplyClinicalDocumentTemplateSelection,
} from '@/features/clinical-documents/hooks/clinicalDocumentsWorkspaceModelSupport';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';

interface HandleClinicalDocumentTemplateSelectionParams {
  templateId: string;
  draft: ClinicalDocumentRecord | null;
  canEdit: boolean;
  setSelectedTemplateId: (templateId: string) => void;
  applyTemplate: (templateId: string) => void;
}

export const handleClinicalDocumentTemplateSelection = ({
  templateId,
  draft,
  canEdit,
  setSelectedTemplateId,
  applyTemplate,
}: HandleClinicalDocumentTemplateSelectionParams): void => {
  setSelectedTemplateId(templateId);
  if (!canApplyClinicalDocumentTemplateSelection({ draft, canEdit })) {
    return;
  }

  applyTemplate(templateId);
};

interface ExecuteClinicalDocumentTemplateRestoreParams {
  draft: ClinicalDocumentRecord | null;
  canEdit: boolean;
  confirm: (
    options: ReturnType<typeof buildRestoreClinicalDocumentTemplateConfirmOptions>
  ) => Promise<boolean>;
  restoreTemplateContent: () => void;
  info: (title: string, message?: string) => void;
}

export const executeClinicalDocumentTemplateRestore = async ({
  draft,
  canEdit,
  confirm,
  restoreTemplateContent,
  info,
}: ExecuteClinicalDocumentTemplateRestoreParams): Promise<void> => {
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

interface ToggleClinicalDocumentAnnexParams {
  draft: ClinicalDocumentRecord | null;
  canEdit: boolean;
  patchAnnexContent: (content: string) => void;
  scrollToAnnex: () => void;
}

export const toggleClinicalDocumentAnnex = ({
  draft,
  canEdit,
  patchAnnexContent,
  scrollToAnnex,
}: ToggleClinicalDocumentAnnexParams): void => {
  if (!canEdit || !draft) {
    return;
  }

  if (draft.annexContent == null) {
    patchAnnexContent('<br>');
  }

  scrollToAnnex();
};
