/**
 * ClinicalDocumentStatusBar
 *
 * Renders autosave status and Drive sync state in the modal header.
 * Separated from the formatting toolbar for clearer UI hierarchy.
 */

import React, { useMemo } from 'react';
import { Check, CheckCircle2, Loader2, UploadCloud } from 'lucide-react';
import { resolveAutosaveIndicatorState } from '@/features/clinical-documents/controllers/clinicalDocumentAutosaveIndicatorController';

interface ClinicalDocumentStatusBarProps {
  isSaving: boolean;
  lastSavedAt?: string;
  isUploadingPdf: boolean;
  driveExported: boolean;
  onUploadPdf: () => void;
}

const btnBase =
  'inline-flex h-7 items-center rounded-md border px-2 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300';

export const ClinicalDocumentStatusBar: React.FC<ClinicalDocumentStatusBarProps> = ({
  isSaving,
  lastSavedAt,
  isUploadingPdf,
  driveExported,
  onUploadPdf,
}) => {
  const autosaveState = useMemo(
    () => resolveAutosaveIndicatorState(isSaving, false, lastSavedAt),
    [isSaving, lastSavedAt]
  );

  return (
    <div className="flex items-center gap-2">
      {/* Autosave indicator */}
      <span
        className="flex items-center gap-1 text-[9px] font-semibold tracking-wide"
        aria-live="polite"
      >
        {autosaveState.phase === 'saving' && (
          <>
            <Loader2 size={10} className="animate-spin text-slate-400" />
            <span className="text-slate-400">Guardando...</span>
          </>
        )}
        {autosaveState.phase === 'saved' && (
          <>
            <Check size={10} className="text-emerald-500" />
            <span className="text-emerald-500">
              Guardado{autosaveState.savedAtLabel ? ` ${autosaveState.savedAtLabel}` : ''}
            </span>
          </>
        )}
      </span>

      {/* Drive sync */}
      <button
        type="button"
        onClick={onUploadPdf}
        disabled={isUploadingPdf}
        className={`${btnBase} ${
          driveExported
            ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
            : 'border-blue-200 text-blue-700 hover:bg-blue-50'
        }`}
      >
        {driveExported ? (
          <CheckCircle2 size={11} className="mr-1 inline" />
        ) : (
          <UploadCloud size={11} className="mr-1 inline" />
        )}
        {driveExported ? 'Drive ✓' : 'Drive'}
      </button>
    </div>
  );
};
