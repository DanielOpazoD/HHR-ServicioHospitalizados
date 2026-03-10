import React from 'react';
import {
  Bold,
  CheckCircle2,
  Eraser,
  IndentDecrease,
  IndentIncrease,
  Italic,
  List,
  ListOrdered,
  Printer,
  Redo2,
  RotateCcw,
  SquarePen,
  Underline,
  Undo2,
  UploadCloud,
} from 'lucide-react';

import { canSignClinicalDocument } from '@/features/clinical-documents/controllers/clinicalDocumentPermissionController';
import type {
  ClinicalDocumentFormattingCommand,
  ClinicalDocumentSheetProps,
} from '@/features/clinical-documents/components/clinicalDocumentSheetShared';

interface ClinicalDocumentFormattingToolbarProps {
  selectedDocument: NonNullable<ClinicalDocumentSheetProps['selectedDocument']>;
  hasPendingRemoteUpdate: boolean;
  hasLocalDraftChanges: boolean;
  canEdit: boolean;
  canUnsignSelectedDocument: boolean;
  role: ClinicalDocumentSheetProps['role'];
  isSaving: boolean;
  isUploadingPdf: boolean;
  formattingDisabled: boolean;
  isFormattingOpen: boolean;
  activeEditorHistoryState: { canUndo: boolean; canRedo: boolean };
  onApplyPendingRemoteUpdate?: () => void;
  onDiscardLocalDraftChanges?: () => void;
  onSign: () => void;
  onUnsign: () => void;
  onPrint: () => void;
  onUploadPdf: () => void;
  onResetDocumentContent: () => void;
  onToggleFormatting: () => void;
  onApplyFormatting: (command: ClinicalDocumentFormattingCommand) => void;
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
  { command: 'undo' as const, label: 'Deshacer', icon: Undo2 },
  { command: 'redo' as const, label: 'Rehacer', icon: Redo2 },
];

export const ClinicalDocumentFormattingToolbar: React.FC<
  ClinicalDocumentFormattingToolbarProps
> = ({
  selectedDocument,
  canEdit,
  canUnsignSelectedDocument,
  role,
  isSaving,
  isUploadingPdf,
  formattingDisabled,
  isFormattingOpen,
  activeEditorHistoryState,
  onSign,
  onUnsign,
  onPrint,
  onUploadPdf,
  onResetDocumentContent,
  onToggleFormatting,
  onApplyFormatting,
}) => {
  const driveExported = selectedDocument.pdf?.exportStatus === 'exported';

  return (
    <div className="flex flex-wrap items-center justify-end gap-3 rounded-2xl bg-white border border-slate-200 px-4 py-3">
      <div className="relative flex flex-wrap gap-2 shrink-0">
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
          className={`rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest disabled:cursor-not-allowed disabled:text-slate-300 disabled:border-slate-200 ${
            driveExported
              ? 'border border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              : 'border border-blue-200 text-blue-700 hover:bg-blue-50'
          }`}
        >
          {driveExported ? (
            <CheckCircle2 size={14} className="inline mr-2" />
          ) : (
            <UploadCloud size={14} className="inline mr-2" />
          )}
          {driveExported ? 'Guardado en Drive' : 'Drive'}
        </button>
        <button
          type="button"
          onClick={onResetDocumentContent}
          disabled={!canEdit || selectedDocument.isLocked}
          className="rounded-xl border border-amber-200 px-3 py-2 text-xs font-black uppercase tracking-widest text-amber-700 hover:bg-amber-50 disabled:cursor-not-allowed disabled:text-slate-300 disabled:border-slate-200"
        >
          <SquarePen size={14} className="inline mr-2" />
          Reiniciar
        </button>
        <button
          type="button"
          onClick={onToggleFormatting}
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
                    onClick={() => onApplyFormatting(action.command)}
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
      <span
        className={`min-w-[92px] text-right text-[11px] font-bold uppercase tracking-wider ${
          isSaving ? 'text-slate-400' : 'text-transparent select-none'
        }`}
        aria-live="polite"
      >
        Guardando...
      </span>
    </div>
  );
};
