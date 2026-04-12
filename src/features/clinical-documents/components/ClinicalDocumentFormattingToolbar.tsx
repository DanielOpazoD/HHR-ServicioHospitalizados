/**
 * ClinicalDocumentFormattingToolbar
 *
 * Centered editing tools: Print, Format, Restore (icon), Zoom +/-
 * LAB moved to sidebar. Status (autosave, Drive) in header right side.
 */

import React from 'react';
import {
  Bold,
  Eraser,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Printer,
  RotateCcw,
  Underline,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

import type {
  ClinicalDocumentFormattingCommand,
  ClinicalDocumentSheetProps,
} from '@/features/clinical-documents/components/clinicalDocumentSheetShared';

interface ClinicalDocumentFormattingToolbarProps {
  selectedDocument: NonNullable<ClinicalDocumentSheetProps['selectedDocument']>;
  canEdit: boolean;
  formattingDisabled: boolean;
  isFormattingOpen: boolean;
  onPrint: () => void;
  onRestoreTemplate: () => void;
  onToggleFormatting: () => void;
  onApplyFormatting: (command: ClinicalDocumentFormattingCommand) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

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

const Divider = () => <div className="h-4 w-px bg-slate-200/70 shrink-0" />;

const iconBtn =
  'inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300';

export const ClinicalDocumentFormattingToolbar: React.FC<
  ClinicalDocumentFormattingToolbarProps
> = ({
  selectedDocument,
  canEdit,
  formattingDisabled,
  isFormattingOpen,
  onPrint,
  onRestoreTemplate,
  onToggleFormatting,
  onApplyFormatting,
  zoom,
  onZoomIn,
  onZoomOut,
}) => {
  const formattingReady = canEdit && !selectedDocument.isLocked && !formattingDisabled;
  const editEnabled = canEdit && !selectedDocument.isLocked;

  return (
    <div className="flex items-center gap-1.5 bg-transparent">
      {/* Print */}
      <button
        type="button"
        onClick={onPrint}
        className={`${iconBtn} border-slate-200 text-slate-600 hover:bg-slate-50`}
        aria-label="Imprimir PDF"
        title="Imprimir PDF"
      >
        <Printer size={17} />
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
        <Bold size={17} />
      </button>

      {/* Restore (icon only) */}
      <button
        type="button"
        onClick={onRestoreTemplate}
        disabled={!editEnabled}
        aria-label="Restablecer plantilla"
        title="Restablecer plantilla"
        className={`${iconBtn} border-amber-200 text-amber-600 hover:bg-amber-50`}
      >
        <RotateCcw size={17} />
      </button>

      <Divider />

      {/* Zoom */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoom <= 60}
        className={`${iconBtn} border-slate-200 text-slate-600 hover:bg-slate-50`}
        title="Reducir zoom"
      >
        <ZoomOut size={17} />
      </button>
      <span className="text-[9px] font-mono text-slate-400 w-7 text-center shrink-0">{zoom}%</span>
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoom >= 150}
        className={`${iconBtn} border-slate-200 text-slate-600 hover:bg-slate-50`}
        title="Aumentar zoom"
      >
        <ZoomIn size={17} />
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
                  <Icon size={14} />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
