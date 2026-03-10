import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { appendClinicalDocumentIndicationText } from '@/features/clinical-documents/controllers/clinicalDocumentIndicationsController';
import { normalizeClinicalDocumentContentForStorage } from '@/features/clinical-documents/controllers/clinicalDocumentRichTextController';
import {
  moveClinicalDocumentVisibleSection,
  reorderClinicalDocumentVisibleSections,
} from '@/features/clinical-documents/controllers/clinicalDocumentSectionOrderController';

export interface ClinicalDocumentDraftBaseState {
  document: ClinicalDocumentRecord | null;
  snapshot: string;
  updatedAt: string;
}

export interface ClinicalDocumentDraftReducerState {
  draft: ClinicalDocumentRecord | null;
  isSaving: boolean;
  hasPendingRemoteUpdate: boolean;
  baseState: ClinicalDocumentDraftBaseState;
  pendingRemoteState: ClinicalDocumentDraftBaseState;
}

export type ClinicalDocumentDraftAction =
  | {
      type: 'LOAD_DOCUMENT';
      document: ClinicalDocumentRecord | null;
      snapshot: string;
      commitAsBase?: boolean;
    }
  | { type: 'REMOTE_UPDATE_RECEIVED'; document: ClinicalDocumentRecord; snapshot: string }
  | { type: 'APPLY_REMOTE_UPDATE' }
  | { type: 'DISCARD_LOCAL_CHANGES' }
  | { type: 'PATCH_FIELD'; fieldId: string; value: string }
  | { type: 'PATCH_FIELD_LABEL'; fieldId: string; label: string }
  | { type: 'SET_FIELD_VISIBILITY'; fieldId: string; visible: boolean }
  | { type: 'PATCH_SECTION'; sectionId: string; content: string }
  | { type: 'APPEND_SECTION_TEXT'; sectionId: string; text: string }
  | { type: 'PATCH_SECTION_TITLE'; sectionId: string; title: string }
  | { type: 'SET_SECTION_VISIBILITY'; sectionId: string; visible: boolean }
  | { type: 'MOVE_SECTION'; sectionId: string; direction: 'up' | 'down' }
  | { type: 'REORDER_SECTION'; sourceSectionId: string; targetSectionId: string }
  | { type: 'PATCH_DOCUMENT_TITLE'; title: string }
  | { type: 'PATCH_PATIENT_INFO_TITLE'; title: string }
  | { type: 'PATCH_FOOTER_LABEL'; kind: 'medico' | 'especialidad'; title: string }
  | {
      type: 'PATCH_DOCUMENT_META';
      patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>;
    }
  | { type: 'RESET_DOCUMENT_CONTENT' }
  | { type: 'AUTOSAVE_REQUESTED' }
  | { type: 'AUTOSAVE_COMMIT_BASE'; document: ClinicalDocumentRecord; snapshot: string }
  | { type: 'AUTOSAVE_SUCCEEDED'; document: ClinicalDocumentRecord; snapshot: string }
  | { type: 'AUTOSAVE_FAILED' }
  | { type: 'SET_IS_SAVING'; value: boolean };

const emptyBaseState = (): ClinicalDocumentDraftBaseState => ({
  document: null,
  snapshot: '',
  updatedAt: '',
});

export const buildClinicalDocumentDraftBaseState = (
  document: ClinicalDocumentRecord | null,
  snapshot: string
): ClinicalDocumentDraftBaseState => ({
  document: document ? structuredClone(document) : null,
  snapshot,
  updatedAt: document?.audit.updatedAt || '',
});

export const createClinicalDocumentDraftReducerInitialState =
  (): ClinicalDocumentDraftReducerState => ({
    draft: null,
    isSaving: false,
    hasPendingRemoteUpdate: false,
    baseState: emptyBaseState(),
    pendingRemoteState: emptyBaseState(),
  });

const patchDraft = (
  state: ClinicalDocumentDraftReducerState,
  patcher: (draft: ClinicalDocumentRecord) => ClinicalDocumentRecord
): ClinicalDocumentDraftReducerState => ({
  ...state,
  draft: state.draft ? patcher(state.draft) : state.draft,
});

const commitDocumentAsBase = (
  state: ClinicalDocumentDraftReducerState,
  document: ClinicalDocumentRecord | null,
  snapshot: string
): ClinicalDocumentDraftReducerState => ({
  ...state,
  draft: document ? structuredClone(document) : null,
  hasPendingRemoteUpdate: false,
  baseState: buildClinicalDocumentDraftBaseState(document, snapshot),
  pendingRemoteState: emptyBaseState(),
});

export const clinicalDocumentDraftReducer = (
  state: ClinicalDocumentDraftReducerState,
  action: ClinicalDocumentDraftAction
): ClinicalDocumentDraftReducerState => {
  switch (action.type) {
    case 'LOAD_DOCUMENT':
      return action.commitAsBase === false
        ? {
            ...state,
            draft: action.document ? structuredClone(action.document) : null,
          }
        : commitDocumentAsBase(state, action.document, action.snapshot);
    case 'REMOTE_UPDATE_RECEIVED':
      return {
        ...state,
        hasPendingRemoteUpdate: true,
        pendingRemoteState: buildClinicalDocumentDraftBaseState(action.document, action.snapshot),
      };
    case 'APPLY_REMOTE_UPDATE':
      if (!state.pendingRemoteState.document || !state.pendingRemoteState.snapshot) {
        return state;
      }
      return commitDocumentAsBase(
        state,
        state.pendingRemoteState.document,
        state.pendingRemoteState.snapshot
      );
    case 'DISCARD_LOCAL_CHANGES': {
      const fallbackState = state.pendingRemoteState.document
        ? state.pendingRemoteState
        : state.baseState.document
          ? state.baseState
          : null;
      if (!fallbackState?.document) {
        return state;
      }
      return commitDocumentAsBase(state, fallbackState.document, fallbackState.snapshot);
    }
    case 'PATCH_FIELD':
      return patchDraft(state, draft => ({
        ...draft,
        patientFields: draft.patientFields.map(field =>
          field.id === action.fieldId ? { ...field, value: action.value } : field
        ),
      }));
    case 'PATCH_FIELD_LABEL':
      return patchDraft(state, draft => ({
        ...draft,
        patientFields: draft.patientFields.map(field =>
          field.id === action.fieldId ? { ...field, label: action.label } : field
        ),
      }));
    case 'SET_FIELD_VISIBILITY':
      return patchDraft(state, draft => ({
        ...draft,
        patientFields: draft.patientFields.map(field =>
          field.id === action.fieldId ? { ...field, visible: action.visible } : field
        ),
      }));
    case 'PATCH_SECTION':
      return patchDraft(state, draft => ({
        ...draft,
        sections: draft.sections.map(section =>
          section.id === action.sectionId
            ? {
                ...section,
                content: normalizeClinicalDocumentContentForStorage(action.content),
              }
            : section
        ),
      }));
    case 'APPEND_SECTION_TEXT':
      return patchDraft(state, draft => ({
        ...draft,
        sections: draft.sections.map(section =>
          section.id === action.sectionId
            ? {
                ...section,
                content: appendClinicalDocumentIndicationText(section.content, action.text),
              }
            : section
        ),
      }));
    case 'PATCH_SECTION_TITLE':
      return patchDraft(state, draft => ({
        ...draft,
        sections: draft.sections.map(section =>
          section.id === action.sectionId ? { ...section, title: action.title } : section
        ),
      }));
    case 'SET_SECTION_VISIBILITY':
      return patchDraft(state, draft => ({
        ...draft,
        sections: draft.sections.map(section =>
          section.id === action.sectionId ? { ...section, visible: action.visible } : section
        ),
      }));
    case 'REORDER_SECTION':
      return patchDraft(state, draft => ({
        ...draft,
        sections: reorderClinicalDocumentVisibleSections(
          draft.sections,
          action.sourceSectionId,
          action.targetSectionId
        ),
      }));
    case 'MOVE_SECTION':
      return patchDraft(state, draft => ({
        ...draft,
        sections: moveClinicalDocumentVisibleSection(
          draft.sections,
          action.sectionId,
          action.direction
        ),
      }));
    case 'PATCH_DOCUMENT_TITLE':
      return patchDraft(state, draft => ({
        ...draft,
        title: action.title,
      }));
    case 'PATCH_PATIENT_INFO_TITLE':
      return patchDraft(state, draft => ({
        ...draft,
        patientInfoTitle: action.title,
      }));
    case 'PATCH_FOOTER_LABEL':
      return patchDraft(state, draft =>
        action.kind === 'medico'
          ? { ...draft, footerMedicoLabel: action.title }
          : { ...draft, footerEspecialidadLabel: action.title }
      );
    case 'PATCH_DOCUMENT_META':
      return patchDraft(state, draft => ({
        ...draft,
        ...action.patch,
      }));
    case 'RESET_DOCUMENT_CONTENT':
      return patchDraft(state, draft => ({
        ...draft,
        medico: '',
        especialidad: '',
        sections: draft.sections.map(section => ({
          ...section,
          content: '',
          visible: true,
        })),
      }));
    case 'AUTOSAVE_REQUESTED':
      return {
        ...state,
        isSaving: true,
      };
    case 'AUTOSAVE_COMMIT_BASE':
      return {
        ...state,
        isSaving: false,
        hasPendingRemoteUpdate:
          state.pendingRemoteState.snapshot !== action.snapshot && state.hasPendingRemoteUpdate,
        baseState: buildClinicalDocumentDraftBaseState(action.document, action.snapshot),
        pendingRemoteState:
          state.pendingRemoteState.snapshot === action.snapshot
            ? emptyBaseState()
            : state.pendingRemoteState,
      };
    case 'AUTOSAVE_SUCCEEDED':
      return {
        ...commitDocumentAsBase(state, action.document, action.snapshot),
        isSaving: false,
      };
    case 'AUTOSAVE_FAILED':
      return {
        ...state,
        isSaving: false,
      };
    case 'SET_IS_SAVING':
      return {
        ...state,
        isSaving: action.value,
      };
    default:
      return state;
  }
};
