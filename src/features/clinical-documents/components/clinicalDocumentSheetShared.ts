import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import type { ClinicalDocumentIndicationSpecialtyId } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import type { ClinicalDocumentPlanSubsectionId } from '@/features/clinical-documents/controllers/clinicalDocumentPlanSectionController';
import type { ClinicalDocumentIndicationsCatalog } from '@/features/clinical-documents/services/clinicalDocumentIndicationsCatalogService';
import type { DragEvent, ReactNode, SetStateAction } from 'react';

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
  insertHtml: (html: string) => void;
}

export interface ClinicalDocumentSheetProps {
  selectedDocument: ClinicalDocumentRecord | null;
  canEdit: boolean;
  isSaving: boolean;
  lastSavedAt?: string;
  isUploadingPdf: boolean;
  toolbar?: ReactNode;
  activeTitleTarget: string | null;
  activeEditorSectionId: string | null;
  onSetActiveTitleTarget: React.Dispatch<SetStateAction<string | null>>;
  draggedSectionId: string | null;
  dragOverSectionId: string | null;
  activePlanSubsectionId: ClinicalDocumentPlanSubsectionId;
  activeIndicationsSpecialtyId: ClinicalDocumentIndicationSpecialtyId;
  isIndicationsPanelOpen: boolean;
  onSetActivePlanSubsectionId: (subsectionId: ClinicalDocumentPlanSubsectionId) => void;
  onSetActiveIndicationsSpecialtyId: (specialtyId: ClinicalDocumentIndicationSpecialtyId) => void;
  onToggleIndicationsPanel: () => void;
  onEditorActivate: (activeSectionId: string, editorApi: ClinicalDocumentSheetEditorApi) => void;
  onEditorDeactivate: (sectionId: string) => void;
  dragHandlers: {
    onDragStart: (event: DragEvent<HTMLButtonElement>, sectionId: string) => void;
    onDragOver: (event: DragEvent<HTMLElement>, sectionId: string, canInteract: boolean) => void;
    onDragLeave: (sectionId: string) => void;
    onDragEnd: () => void;
  };
  validationIssues: Array<{ message: string }>;
  onPrint: () => void;
  onUploadPdf: () => void;
  patchDocumentTitle: (title: string) => void;
  patchPatientInfoTitle: (title: string) => void;
  patchPatientField: (fieldId: string, value: string) => void;
  patchPatientFieldLabel: (fieldId: string, label: string) => void;
  setPatientFieldVisibility: (fieldId: string, visible: boolean) => void;
  patchSectionTitle: (sectionId: string, title: string) => void;
  patchSection: (sectionId: string, content: string) => void;
  setSectionLayout: (
    sectionId: string,
    layout: import('@/features/clinical-documents/domain/entities').ClinicalDocumentSectionLayout
  ) => void;
  setSectionVisibility: (sectionId: string, visible: boolean) => void;
  moveSection: (sectionId: string, direction: 'up' | 'down') => void;
  reorderSection: (sourceSectionId: string, targetSectionId: string) => void;
  addSection: (referenceSectionId: string, position: 'above' | 'below') => void;
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
  onRestoreTemplate: () => void;
  addClinicalUpdate: () => void;
  patchAnnexContent: (content: string) => void;
  setAnnexIncludedInPrint: (included: boolean) => void;
  clearAnnexContent: () => void;
  onPrintAnnex: () => void;
  patchIeehDraft: (
    draft: import('@/features/clinical-documents/domain/entities').ClinicalDocumentIeehDraft
  ) => void;
  clearIeehDraft: () => void;
  /** Workspace patient data (provides birthDate for IEEH printing). */
  workspacePatient?: { birthDate?: string };
  patchUpdateDate: (sectionId: string, date: string) => void;
  patchUpdateTime: (sectionId: string, time: string) => void;
}

export interface ClinicalDocumentSpecialSectionRendererProps {
  document: ClinicalDocumentRecord;
  section: ClinicalDocumentRecord['sections'][number];
  canEdit: boolean;
  activePlanSubsectionId: ClinicalDocumentPlanSubsectionId;
  setActivePlanSubsectionId: (subsectionId: ClinicalDocumentPlanSubsectionId) => void;
  onPatchSection: (sectionId: string, content: string) => void;
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
