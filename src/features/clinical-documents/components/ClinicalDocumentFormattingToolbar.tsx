/**
 * ClinicalDocumentFormattingToolbar
 *
 * Centered editing tools: Undo/Redo, Print, Format, Restore, Zoom +/-
 * Undo/Redo react to the active editor's history state.
 * LAB moved to sidebar. Status (autosave, Drive) in header right side.
 */

import React, { useState } from 'react';
import {
  Bold,
  Eraser,
  IndentDecrease,
  IndentIncrease,
  Italic,
  Link2,
  List,
  ListOrdered,
  Printer,
  Redo2,
  RotateCcw,
  Table2,
  Underline,
  Undo2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import { ClinicalDocumentLinkDialog } from '@/features/clinical-documents/components/ClinicalDocumentLinkDialog';
import { ClinicalDocumentTableDialog } from '@/features/clinical-documents/components/ClinicalDocumentTableDialog';

import type {
  ClinicalDocumentFormattingCommand,
  ClinicalDocumentSheetProps,
} from '@/features/clinical-documents/components/clinicalDocumentSheetShared';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ClinicalDocumentFormattingToolbarProps {
  selectedDocument: NonNullable<ClinicalDocumentSheetProps['selectedDocument']>;
  canEdit: boolean;
  formattingDisabled: boolean;
  isFormattingOpen: boolean;
  /** Whether the active editor has an undo snapshot available. */
  canUndo: boolean;
  /** Whether the active editor has a redo snapshot available. */
  canRedo: boolean;
  onPrint: () => void;
  onRestoreTemplate: () => void;
  onToggleFormatting: () => void;
  onApplyFormatting: (command: ClinicalDocumentFormattingCommand) => void;
  /** Insert raw HTML at the cursor position of the active editor. */
  onInsertHtml?: (html: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

// ---------------------------------------------------------------------------
// Formatting sub-panel actions
// ---------------------------------------------------------------------------

const formattingActions = [
  { command: 'bold' as const, label: 'Negrita', icon: Bold },
  { command: 'italic' as const, label: 'Cursiva', icon: Italic },
  { command: 'underline' as const, label: 'Subrayado', icon: Underline },
  { command: 'insertUnorderedList' as const, label: 'Viñetas', icon: List },
  { command: 'insertOrderedList' as const, label: 'Lista numerada', icon: ListOrdered },
  { command: 'indent' as const, label: 'Aumentar sangría', icon: IndentIncrease },
  { command: 'outdent' as const, label: 'Disminuir sangría', icon: IndentDecrease },
  { command: 'removeFormat' as const, label: 'Quitar formato', icon: Eraser },
];

// ---------------------------------------------------------------------------
// Shared styles
// ---------------------------------------------------------------------------

/** Icon size (px) for main toolbar buttons. */
const TOOLBAR_ICON_SIZE = 17;

/** Icon size (px) for the expanded formatting sub-panel. */
const FORMATTING_ICON_SIZE = 14;

const Divider = () => <div className="h-4 w-px bg-slate-200/70 shrink-0" />;

const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300';

const defaultIconBtn = `${iconBtn} border-slate-200 text-slate-600 hover:bg-slate-50`;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const ClinicalDocumentFormattingToolbar: React.FC<
  ClinicalDocumentFormattingToolbarProps
> = ({
  selectedDocument,
  canEdit,
  formattingDisabled,
  isFormattingOpen,
  canUndo,
  canRedo,
  onPrint,
  onRestoreTemplate,
  onToggleFormatting,
  onApplyFormatting,
  onInsertHtml,
  zoom,
  onZoomIn,
  onZoomOut,
}) => {
  const formattingReady = canEdit && !selectedDocument.isLocked && !formattingDisabled;
  const editEnabled = canEdit && !selectedDocument.isLocked;
  const [showTableDialog, setShowTableDialog] = useState(false);
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  return (
    <div className="flex items-center gap-1.5 bg-transparent">
      {/* Undo / Redo */}
      <button
        type="button"
        onClick={() => onApplyFormatting('undo')}
        disabled={!editEnabled || !canUndo}
        className={defaultIconBtn}
        aria-label="Deshacer"
        title="Deshacer (Ctrl+Z)"
      >
        <Undo2 size={TOOLBAR_ICON_SIZE} />
      </button>
      <button
        type="button"
        onClick={() => onApplyFormatting('redo')}
        disabled={!editEnabled || !canRedo}
        className={defaultIconBtn}
        aria-label="Rehacer"
        title="Rehacer (Ctrl+Shift+Z)"
      >
        <Redo2 size={TOOLBAR_ICON_SIZE} />
      </button>

      <Divider />

      {/* Print */}
      <button
        type="button"
        onClick={onPrint}
        className={defaultIconBtn}
        aria-label="Imprimir PDF"
        title="Imprimir PDF"
      >
        <Printer size={TOOLBAR_ICON_SIZE} />
      </button>

      <Divider />

      {/* Formatting toggle */}
      <button
        type="button"
        onClick={onToggleFormatting}
        disabled={!editEnabled}
        aria-pressed={isFormattingOpen}
        aria-label="Formato"
        title="Formato avanzado"
        className={`relative ${iconBtn} ${
          formattingReady
            ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
            : 'border-slate-200 text-slate-600 hover:bg-slate-50'
        }`}
      >
        {formattingReady && (
          <span
            aria-hidden="true"
            className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-sky-500"
          />
        )}
        <Bold size={TOOLBAR_ICON_SIZE} />
      </button>

      {/* Table insertion */}
      {onInsertHtml && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowTableDialog(prev => !prev)}
            disabled={!editEnabled}
            aria-label="Insertar tabla"
            title="Insertar tabla"
            className={defaultIconBtn}
          >
            <Table2 size={TOOLBAR_ICON_SIZE} />
          </button>
          {showTableDialog && editEnabled && (
            <ClinicalDocumentTableDialog
              onInsert={html => {
                onInsertHtml(html);
                setShowTableDialog(false);
              }}
              onClose={() => setShowTableDialog(false)}
            />
          )}
        </div>
      )}

      {/* Link insertion */}
      {onInsertHtml && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLinkDialog(prev => !prev)}
            disabled={!editEnabled}
            aria-label="Insertar enlace"
            title="Insertar enlace"
            className={defaultIconBtn}
          >
            <Link2 size={TOOLBAR_ICON_SIZE} />
          </button>
          {showLinkDialog && editEnabled && (
            <ClinicalDocumentLinkDialog
              onInsert={html => {
                onInsertHtml(html);
                setShowLinkDialog(false);
              }}
              onClose={() => setShowLinkDialog(false)}
            />
          )}
        </div>
      )}

      {/* Restore (icon only) */}
      <button
        type="button"
        onClick={onRestoreTemplate}
        disabled={!editEnabled}
        aria-label="Restablecer plantilla"
        title="Restablecer plantilla"
        className={`${iconBtn} border-amber-200 text-amber-600 hover:bg-amber-50`}
      >
        <RotateCcw size={TOOLBAR_ICON_SIZE} />
      </button>

      <Divider />

      {/* Zoom */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= 60}
        className={defaultIconBtn}
        title="Reducir zoom"
      >
        <ZoomOut size={TOOLBAR_ICON_SIZE} />
      </button>
      <span className="text-[9px] font-mono text-slate-400 w-7 text-center shrink-0">{zoom}%</span>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= 150}
        className={defaultIconBtn}
        title="Aumentar zoom"
      >
        <ZoomIn size={TOOLBAR_ICON_SIZE} />
      </button>

      {/* Formatting panel */}
      {isFormattingOpen && (
        <div
          className={`clinical-document-global-toolbar-modal ${
            formattingReady ? 'clinical-document-global-toolbar-modal--ready' : ''
          }`}
        >
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
                  onClick={() => onApplyFormatting(action.command)}
                  disabled={formattingDisabled}
                  aria-label={action.label}
                  title={action.label}
                >
                  <Icon size={FORMATTING_ICON_SIZE} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
