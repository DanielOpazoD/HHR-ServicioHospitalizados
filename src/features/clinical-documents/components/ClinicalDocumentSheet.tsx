import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bold,
  Eye,
  Eraser,
  GripVertical,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Printer,
  Redo2,
  RotateCcw,
  Save,
  Trash2,
  Underline,
  Undo2,
  UploadCloud,
} from 'lucide-react';

import type { UserRole } from '@/types';
import type { ClinicalDocumentRecord } from '@/features/clinical-documents/domain/entities';
import { CLINICAL_DOCUMENT_BRANDING } from '@/features/clinical-documents/domain/branding';
import {
  getClinicalDocumentPatientFieldGridClass,
  getClinicalDocumentPatientFieldLabel,
} from '@/features/clinical-documents/controllers/clinicalDocumentWorkspaceController';
import { canSignClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentPermissionController';
import { InlineEditableTitle } from '@/features/clinical-documents/components/InlineEditableTitle';
import { ClinicalDocumentRichTextEditor } from '@/features/clinical-documents/components/ClinicalDocumentRichTextEditor';

interface ClinicalDocumentSheetProps {
  selectedDocument: ClinicalDocumentRecord | null;
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
  setSectionVisibility: (sectionId: string, visible: boolean) => void;
  moveSection: (sectionId: string, direction: 'up' | 'down') => void;
  reorderSection: (sourceSectionId: string, targetSectionId: string) => void;
  patchFooterLabel: (kind: 'medico' | 'especialidad', title: string) => void;
  patchDocumentMeta: (
    patch: Partial<Pick<ClinicalDocumentRecord, 'medico' | 'especialidad'>>
  ) => void;
}

export const ClinicalDocumentSheet: React.FC<ClinicalDocumentSheetProps> = ({
  selectedDocument,
  canEdit,
  canUnsignSelectedDocument,
  role,
  isSaving,
  isUploadingPdf,
  validationIssues,
  onSave,
  onSign,
  onUnsign,
  onPrint,
  onUploadPdf,
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
}) => {
  const [activeTitleTarget, setActiveTitleTarget] = useState<string | null>(null);
  const [isFormattingOpen, setIsFormattingOpen] = useState(false);
  const [draggedSectionId, setDraggedSectionId] = useState<string | null>(null);
  const [dragOverSectionId, setDragOverSectionId] = useState<string | null>(null);
  const [activeEditorSectionId, setActiveEditorSectionId] = useState<string | null>(null);
  const [activeEditorHistoryState, setActiveEditorHistoryState] = useState({
    canUndo: false,
    canRedo: false,
  });
  const activeEditorSectionIdRef = useRef<string | null>(null);
  const activeEditorApiRef = useRef<{
    element: HTMLDivElement | null;
    canUndo: boolean;
    canRedo: boolean;
    applyCommand: (
      command:
        | 'bold'
        | 'italic'
        | 'underline'
        | 'insertUnorderedList'
        | 'insertOrderedList'
        | 'indent'
        | 'outdent'
        | 'removeFormat'
        | 'undo'
        | 'redo',
      value?: string
    ) => void;
  } | null>(null);

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
  const formattingDisabled = !canEdit || selectedDocument.isLocked || !activeEditorSectionId;

  const formattingActions = [
    { command: 'bold' as const, label: 'Negrita', icon: Bold },
    { command: 'italic' as const, label: 'Cursiva', icon: Italic },
    { command: 'underline' as const, label: 'Subrayado', icon: Underline },
    { command: 'insertUnorderedList' as const, label: 'Viñetas', icon: List },
    { command: 'insertOrderedList' as const, label: 'Lista numerada', icon: ListOrdered },
    { command: 'indent' as const, label: 'Aumentar sangría', icon: IndentIncrease },
    { command: 'outdent' as const, label: 'Disminuir sangría', icon: IndentDecrease },
    { command: 'removeFormat' as const, label: 'Quitar formato', icon: Eraser },
    { command: 'undo' as const, label: 'Deshacer', icon: Undo2 },
    { command: 'redo' as const, label: 'Rehacer', icon: Redo2 },
  ];

  const applyFormatting = (
    command:
      | 'bold'
      | 'italic'
      | 'underline'
      | 'insertUnorderedList'
      | 'insertOrderedList'
      | 'indent'
      | 'outdent'
      | 'removeFormat'
      | 'undo'
      | 'redo',
    value?: string
  ) => {
    if (formattingDisabled) return;
    activeEditorApiRef.current?.element?.focus();
    activeEditorApiRef.current?.applyCommand(command, value);
  };

  const clearActiveEditor = (sectionId: string) => {
    setActiveEditorSectionId(current => (current === sectionId ? null : current));
    if (activeEditorSectionIdRef.current === sectionId) {
      activeEditorApiRef.current = null;
      activeEditorSectionIdRef.current = null;
      setActiveEditorHistoryState({ canUndo: false, canRedo: false });
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-3">
      <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3">
        <div className="relative flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onSave}
            disabled={!canEdit || selectedDocument.isLocked || isSaving}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            <Save size={14} className="inline mr-2" />
            Guardar
          </button>
          <button
            type="button"
            onClick={onSign}
            disabled={!canSignClinicalDocument(role, selectedDocument)}
            className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black uppercase tracking-widest text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-200"
          >
            Firmar
          </button>
          {canUnsignSelectedDocument && (
            <button
              type="button"
              onClick={onUnsign}
              disabled={isSaving}
              className="rounded-xl border border-rose-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:border-slate-200"
            >
              <RotateCcw size={14} className="inline mr-2" />
              Quitar firma
            </button>
          )}
          <button
            type="button"
            onClick={onPrint}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50"
          >
            <Printer size={14} className="inline mr-2" />
            PDF
          </button>
          <button
            type="button"
            onClick={onUploadPdf}
            disabled={isUploadingPdf || selectedDocument.status !== 'signed'}
            className="rounded-xl border border-blue-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:border-slate-200"
          >
            <UploadCloud size={14} className="inline mr-2" />
            Drive
          </button>
          <button
            type="button"
            onClick={() => setIsFormattingOpen(prev => !prev)}
            disabled={!canEdit || selectedDocument.isLocked}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-300"
          >
            Formato
          </button>
          {isFormattingOpen && (
            <div className="clinical-document-global-toolbar-modal">
              <p className="clinical-document-global-toolbar-caption">
                Aplica formato sobre la sección que tengas seleccionada.
              </p>
              <div
                className="clinical-document-toolbar"
                role="toolbar"
                aria-label="Formato global del documento"
              >
                {formattingActions.map(action => {
                  const Icon = action.icon;
                  return (
                    <button
                      key={action.command}
                      type="button"
                      className="clinical-document-toolbar-button"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => applyFormatting(action.command)}
                      disabled={
                        formattingDisabled ||
                        (action.command === 'undo' && !activeEditorHistoryState.canUndo) ||
                        (action.command === 'redo' && !activeEditorHistoryState.canRedo)
                      }
                      aria-label={action.label}
                      title={action.label}
                    >
                      <Icon size={14} />
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
        {isSaving && (
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Guardando...
          </span>
        )}
      </div>

      {validationIssues.length > 0 && selectedDocument.status !== 'signed' && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {validationIssues[0]?.message}
        </div>
      )}

      <div id="clinical-document-sheet" className="clinical-document-sheet">
        <div className="clinical-document-sheet-header">
          <img
            src={CLINICAL_DOCUMENT_BRANDING.leftLogoUrl}
            alt="Logo institucional izquierdo"
            className="clinical-document-sheet-logo"
          />
          <div className="clinical-document-title-wrap">
            <InlineEditableTitle
              value={selectedDocument.title}
              onChange={patchDocumentTitle}
              disabled={!canEdit || selectedDocument.isLocked}
              className="clinical-document-title"
            />
          </div>
          <img
            src={CLINICAL_DOCUMENT_BRANDING.rightLogoUrl}
            alt="Logo institucional derecho"
            className="clinical-document-sheet-logo justify-self-end"
          />
        </div>

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

        <div className="mb-3">
          <InlineEditableTitle
            value={selectedDocument.patientInfoTitle}
            onChange={patchPatientInfoTitle}
            onActivate={() => setActiveTitleTarget('patient-info-title')}
            onDeactivate={() =>
              setActiveTitleTarget(current => (current === 'patient-info-title' ? null : current))
            }
            disabled={!canEdit || selectedDocument.isLocked}
            className="clinical-document-section-title clinical-document-patient-info-title"
          />
          <div className="clinical-document-patient-grid">
            {visiblePatientFields.map(field => (
              <div key={field.id} className={getClinicalDocumentPatientFieldGridClass(field.id)}>
                <span className="clinical-document-field-label-row">
                  <InlineEditableTitle
                    value={getClinicalDocumentPatientFieldLabel(
                      field,
                      selectedDocument.documentType
                    )}
                    onChange={label => patchPatientFieldLabel(field.id, label)}
                    onActivate={() => setActiveTitleTarget(`field:${field.id}`)}
                    onDeactivate={() =>
                      setActiveTitleTarget(current =>
                        current === `field:${field.id}` ? null : current
                      )
                    }
                    disabled={!canEdit || selectedDocument.isLocked}
                    className="clinical-document-patient-label"
                  />
                  {canEdit &&
                    !selectedDocument.isLocked &&
                    activeTitleTarget === `field:${field.id}` && (
                      <button
                        type="button"
                        className="clinical-document-inline-action clinical-document-inline-action--danger"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => setPatientFieldVisibility(field.id, false)}
                        aria-label={`Eliminar campo ${field.label}`}
                        title="Eliminar campo"
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                </span>
                <input
                  type={field.type}
                  value={field.value}
                  onChange={event => patchPatientField(field.id, event.target.value)}
                  readOnly={!canEdit || field.readonly || selectedDocument.isLocked}
                  className="clinical-document-input"
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          {visibleSections.map(section => (
            <div
              key={section.id}
              className={`block clinical-document-section-block${
                dragOverSectionId === section.id ? ' is-drag-over' : ''
              }`}
              onDragOver={event => {
                if (!canEdit || selectedDocument.isLocked || !draggedSectionId) return;
                event.preventDefault();
                setDragOverSectionId(section.id);
              }}
              onDragLeave={() => {
                if (dragOverSectionId === section.id) {
                  setDragOverSectionId(null);
                }
              }}
              onDrop={event => {
                if (!canEdit || selectedDocument.isLocked || !draggedSectionId) return;
                event.preventDefault();
                if (draggedSectionId !== section.id) {
                  reorderSection(draggedSectionId, section.id);
                }
                setDraggedSectionId(null);
                setDragOverSectionId(null);
              }}
            >
              {canEdit && !selectedDocument.isLocked && (
                <button
                  type="button"
                  className="clinical-document-section-drag-handle"
                  draggable
                  onDragStart={event => {
                    if (event.dataTransfer) {
                      event.dataTransfer.effectAllowed = 'move';
                      event.dataTransfer.setData('text/plain', section.id);
                    }
                    setDraggedSectionId(section.id);
                    setDragOverSectionId(null);
                  }}
                  onDragEnd={() => {
                    setDraggedSectionId(null);
                    setDragOverSectionId(null);
                  }}
                  aria-label={`Arrastrar sección ${section.title}`}
                  title="Arrastrar sección"
                >
                  <GripVertical size={14} />
                </button>
              )}
              <span className="clinical-document-field-label-row">
                <InlineEditableTitle
                  value={section.title}
                  onChange={title => patchSectionTitle(section.id, title)}
                  onActivate={() => setActiveTitleTarget(`section:${section.id}`)}
                  onDeactivate={() =>
                    setActiveTitleTarget(current =>
                      current === `section:${section.id}` ? null : current
                    )
                  }
                  disabled={!canEdit || selectedDocument.isLocked}
                  className="clinical-document-section-title"
                />
                {canEdit &&
                  !selectedDocument.isLocked &&
                  activeTitleTarget === `section:${section.id}` && (
                    <>
                      <button
                        type="button"
                        className="clinical-document-inline-action"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => moveSection(section.id, 'up')}
                        aria-label={`Subir sección ${section.title}`}
                        title="Subir sección"
                        disabled={visibleSections[0]?.id === section.id}
                      >
                        <ArrowUp size={12} />
                      </button>
                      <button
                        type="button"
                        className="clinical-document-inline-action"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => moveSection(section.id, 'down')}
                        aria-label={`Bajar sección ${section.title}`}
                        title="Bajar sección"
                        disabled={visibleSections[visibleSections.length - 1]?.id === section.id}
                      >
                        <ArrowDown size={12} />
                      </button>
                      <button
                        type="button"
                        className="clinical-document-inline-action clinical-document-inline-action--danger"
                        onMouseDown={event => event.preventDefault()}
                        onClick={() => setSectionVisibility(section.id, false)}
                        aria-label={`Eliminar sección ${section.title}`}
                        title="Eliminar sección"
                      >
                        <Trash2 size={12} />
                      </button>
                    </>
                  )}
              </span>
              <ClinicalDocumentRichTextEditor
                sectionId={section.id}
                sectionTitle={section.title}
                value={section.content}
                onChange={content => patchSection(section.id, content)}
                onActivate={(activeSectionId, editorApi) => {
                  activeEditorApiRef.current = editorApi;
                  activeEditorSectionIdRef.current = activeSectionId;
                  setActiveEditorSectionId(activeSectionId);
                  setActiveEditorHistoryState({
                    canUndo: editorApi.canUndo,
                    canRedo: editorApi.canRedo,
                  });
                }}
                onDeactivate={clearActiveEditor}
                disabled={!canEdit || selectedDocument.isLocked}
              />
            </div>
          ))}
        </div>

        <div className="clinical-document-footer">
          <div className="flex flex-col gap-1">
            <InlineEditableTitle
              value={selectedDocument.footerMedicoLabel}
              onChange={title => patchFooterLabel('medico', title)}
              onDeactivate={() => setActiveTitleTarget(null)}
              disabled={!canEdit || selectedDocument.isLocked}
              className="clinical-document-section-title"
            />
            <input
              type="text"
              value={selectedDocument.medico}
              onChange={event => patchDocumentMeta({ medico: event.target.value })}
              readOnly={!canEdit || selectedDocument.isLocked}
              className="clinical-document-input"
            />
          </div>
          <div className="flex flex-col gap-1">
            <InlineEditableTitle
              value={selectedDocument.footerEspecialidadLabel}
              onChange={title => patchFooterLabel('especialidad', title)}
              onDeactivate={() => setActiveTitleTarget(null)}
              disabled={!canEdit || selectedDocument.isLocked}
              className="clinical-document-section-title"
            />
            <input
              type="text"
              value={selectedDocument.especialidad}
              onChange={event => patchDocumentMeta({ especialidad: event.target.value })}
              readOnly={!canEdit || selectedDocument.isLocked}
              className="clinical-document-input"
            />
          </div>
        </div>
      </div>
    </div>
  );
};
