/**
 * ClinicalDocumentFormattingToolbar
 *
 * Editing tools for the clinical document:
 * - Inserción: Lab summary
 * - Exportar: PDF print
 * - Edición: formatting toggle, restore template
 *
 * Status (autosave, Drive) is in ClinicalDocumentStatusBar.
 * Content actions (update, annex) are in the sidebar.
 */

import React, { useState } from 'react';
import {
  Bold,
  Eraser,
  FlaskConical,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Printer,
  RotateCcw,
  Underline,
} from 'lucide-react';
import { ClinicalDocumentLabInsertDialog } from './ClinicalDocumentLabInsertDialog';

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
  patientRut?: string;
  onInsertLabText?: (text: string) => void;
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

const btnBase =
  'inline-flex h-7 items-center rounded-md border px-2 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300';

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
  patientRut,
  onInsertLabText,
}) => {
  const [showLabDialog, setShowLabDialog] = useState(false);
  const formattingReady = canEdit && !selectedDocument.isLocked && !formattingDisabled;
  const editEnabled = canEdit && !selectedDocument.isLocked;

  return (
    <div className="flex flex-wrap items-center gap-1.5 bg-transparent px-0 py-0">
      {/* ── Inserción ── */}
      {patientRut && onInsertLabText && (
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowLabDialog(prev => !prev)}
            className={`${btnBase} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}
            title="Insertar resumen de laboratorio"
          >
            <FlaskConical size={11} className="mr-1 inline" />
            Lab
          </button>
          {showLabDialog && (
            <ClinicalDocumentLabInsertDialog
              patientRut={patientRut}
              onInsert={text => {
                onInsertLabText(text);
                setShowLabDialog(false);
              }}
              onClose={() => setShowLabDialog(false)}
            />
          )}
        </div>
      )}

      <Divider />

      {/* ── Exportar ── */}
      <button
        type="button"
        onClick={onPrint}
        className={`${btnBase} border-slate-200 text-slate-700 hover:bg-slate-50`}
      >
        <Printer size={11} className="mr-1 inline" />
        PDF
      </button>

      <Divider />

      {/* ── Edición ── */}
      <button
        type="button"
        onClick={onToggleFormatting}
        disabled={!editEnabled}
        aria-pressed={isFormattingOpen}
        aria-label="Formato"
        title="Formato"
        className={`relative inline-flex h-7 w-7 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300 ${
          formattingReady
            ? 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100'
            : 'border-slate-200 text-slate-700 hover:bg-slate-50'
        }`}
      >
        <span
          aria-hidden="true"
          className={`absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full ${
            formattingReady ? 'bg-sky-500' : 'bg-transparent'
          }`}
        />
        <Bold size={12} />
      </button>
      <button
        type="button"
        onClick={onRestoreTemplate}
        disabled={!editEnabled}
        aria-label="Restablecer plantilla"
        title="Restablecer plantilla"
        className={`${btnBase} border-amber-200 text-amber-700 hover:bg-amber-50`}
      >
        <RotateCcw size={11} className="mr-1 inline" />
        Restablecer
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
