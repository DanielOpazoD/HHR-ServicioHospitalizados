import type { UserRole } from '@/types';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import type { ClinicalDocumentIndicationSpecialtyId } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import type { ClinicalDocumentPlanSubsectionId } from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';
import type { ClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';

export type ClinicalDocumentFormattingCommand =
  | 'bold'
  | 'italic'
  | 'underline'
  | 'insertUnorderedList'
  | 'insertOrderedList'
  | 'indent'
  | 'outdent'
  | 'removeFormat'
  | 'undo'
  | 'redo';

export interface ClinicalDocumentSheetEditorApi {
  element: HTMLDivElement | null;
  canUndo: boolean;
  canRedo: boolean;
  applyCommand: (command: ClinicalDocumentFormattingCommand, value?: string) => void;
  insertText: (text: string) => boolean;
}

export interface ClinicalDocumentSheetProps {
  selectedDocument: ClinicalDocumentRecord | null;
  hasPendingRemoteUpdate?: boolean;
  hasLocalDraftChanges?: boolean;
  onApplyPendingRemoteUpdate?: () => void;
  onDiscardLocalDraftChanges?: () => void;
  canEdit: boolean;
  canUnsignSelectedDocument: boolean;
  role: UserRole | undefined;
  isSaving: boolean;
  isUploadingPdf: boolean;
  validationIssues: Array<{ message: string }>;
  onSave: () => void;
  onSign: () => void;
  onUnsign: () => void;
  onPrint: () => void;
  onUploadPdf: () => void;
  patchDocumentTitle: (title: string) => void;
  patchPatientInfoTitle: (title: string) => void;
  patchPatientField: (fieldId: string, value: string) => void;
  patchPatientFieldLabel: (fieldId: string, label: string) => void;
  setPatientFieldVisibility: (fieldId: string, visible: boolean) => void;
  patchSectionTitle: (sectionId: string, title: string) => void;
  patchSection: (sectionId: string, content: string) => void;
  appendSectionText: (sectionId: string, text: string) => void;
  setSectionVisibility: (sectionId: string, visible: boolean) => void;
  moveSection: (sectionId: string, direction: 'up' | 'down') => void;
  reorderSection: (sourceSectionId: string, targetSectionId: string) => void;
  patchFooterLabel: (kind: 'medico' | 'especialidad', title: string) => void;
  patchDocumentMeta: (
    patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>
  ) => void;
  indicationsCatalog: ClinicalDocumentIndicationsCatalog;
  isSavingCustomIndication: boolean;
  customIndicationError: string | null;
  addCustomIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    text: string
  ) => Promise<boolean>;
  updateIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string,
    text: string
  ) => Promise<boolean>;
  deleteIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string
  ) => Promise<boolean>;
  importIndicationsCatalog: (catalog: unknown) => Promise<boolean>;
  onResetDocumentContent: () => void;
}

export interface ClinicalDocumentSpecialSectionRendererProps {
  document: ClinicalDocumentRecord;
  section: ClinicalDocumentRecord['sections'][number];
  canEdit: boolean;
  activePlanSubsectionId: ClinicalDocumentPlanSubsectionId;
  setActivePlanSubsectionId: (subsectionId: ClinicalDocumentPlanSubsectionId) => void;
  onPatchSection: (sectionId: string, content: string) => void;
  onAppendSectionText: (sectionId: string, text: string) => void;
  onEditorActivate: (activeSectionId: string, editorApi: ClinicalDocumentSheetEditorApi) => void;
  onEditorDeactivate: (sectionId: string) => void;
  indicationsCatalog: ClinicalDocumentIndicationsCatalog;
  isSavingCustomIndication: boolean;
  customIndicationError: string | null;
  activeIndicationsSpecialtyId: ClinicalDocumentIndicationSpecialtyId;
  setActiveIndicationsSpecialtyId: (specialtyId: ClinicalDocumentIndicationSpecialtyId) => void;
  isIndicationsPanelOpen: boolean;
  onToggleIndicationsPanel: () => void;
  addCustomIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    text: string
  ) => Promise<boolean>;
  updateIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string,
    text: string
  ) => Promise<boolean>;
  deleteIndication: (
    specialtyId: ClinicalDocumentIndicationSpecialtyId,
    itemId: string
  ) => Promise<boolean>;
  importIndicationsCatalog: (catalog: unknown) => Promise<boolean>;
}
