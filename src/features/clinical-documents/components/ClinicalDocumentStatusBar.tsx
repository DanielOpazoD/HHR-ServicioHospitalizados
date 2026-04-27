/**
 * ClinicalDocumentStatusBar
 *
 * Renders autosave status and Drive sync state in the modal header.
 * Separated from the formatting toolbar for clearer UI hierarchy.
 */

import React, { useMemo } from 'react';
import { AlertCircle, CheckCircle2, ExternalLink, Loader2, UploadCloud } from 'lucide-react';
import { resolveAutosaveIndicatorState } from '@/features/clinical-documents/controllers/clinicalDocumentAutosaveIndicatorController';
import type { ClinicalDocumentPdfMeta } from '@/features/clinical-documents/domain/entities';

interface ClinicalDocumentStatusBarProps {
  isSaving: boolean;
  lastSavedAt?: string;
  hasLocalDraftChanges: boolean;
  hasPendingRemoteUpdate: boolean;
  isUploadingPdf: boolean;
  pdf?: ClinicalDocumentPdfMeta;
  onUploadPdf: () => void;
  onApplyPendingRemoteUpdate: () => void;
  onDiscardLocalDraftChanges: () => void;
}

const btnBase =
  'inline-flex h-7 items-center rounded-md border px-2 text-[9px] font-bold uppercase tracking-[0.12em] transition-colors disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-300';

export const ClinicalDocumentStatusBar: React.FC<ClinicalDocumentStatusBarProps> = ({
  isSaving,
  lastSavedAt,
  hasLocalDraftChanges,
  hasPendingRemoteUpdate,
  isUploadingPdf,
  pdf,
  onUploadPdf,
  onApplyPendingRemoteUpdate,
  onDiscardLocalDraftChanges,
}) => {
  const autosaveState = useMemo(
    () => resolveAutosaveIndicatorState(isSaving, hasLocalDraftChanges, lastSavedAt),
    [hasLocalDraftChanges, isSaving, lastSavedAt]
  );

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {autosaveState.phase === 'saving' && (
        <span
          className="flex items-center gap-1 text-[9px] font-semibold tracking-wide"
          aria-live="polite"
        >
          <>
            <Loader2 size={10} className="animate-spin text-slate-400" />
            <span className="text-slate-400">Guardando...</span>
          </>
        </span>
      )}

      {autosaveState.phase === 'dirty' && (
        <span
          className="flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-amber-700"
          aria-live="polite"
        >
          <AlertCircle size={11} />
          Cambios locales sin guardar
        </span>
      )}

      {hasPendingRemoteUpdate && (
        <div
          className="flex items-center gap-1 rounded-md border border-orange-200 bg-orange-50 px-2 py-1"
          role="status"
          aria-live="polite"
        >
          <span className="inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.12em] text-orange-700">
            <AlertCircle size={11} />
            Actualización remota pendiente
          </span>
          <button
            type="button"
            onClick={onApplyPendingRemoteUpdate}
            className="rounded border border-orange-200 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-orange-700 hover:bg-orange-100"
          >
            Recargar remoto
          </button>
          <button
            type="button"
            onClick={onDiscardLocalDraftChanges}
            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-slate-600 hover:bg-slate-100"
          >
            Descartar local
          </button>
        </div>
      )}

      <div className="flex items-center gap-1.5">
        {pdf?.exportStatus === 'exported' ? (
          <>
            <span className="group relative inline-flex items-center gap-1 rounded-md border border-emerald-200 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-emerald-700">
              <CheckCircle2 size={11} />
              Drive exportado
              {autosaveState.savedAtLabel && (
                <span
                  role="tooltip"
                  className="pointer-events-none absolute left-1/2 top-full z-30 mt-2 -translate-x-1/2 whitespace-nowrap rounded-md border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold normal-case tracking-normal text-slate-600 opacity-0 shadow-lg transition-opacity group-hover:opacity-100"
                >
                  Guardado {autosaveState.savedAtLabel}
                </span>
              )}
            </span>
            {pdf.webViewLink && (
              <a
                href={pdf.webViewLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-7 items-center rounded-md border border-slate-200 px-2 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-600 hover:bg-slate-50"
              >
                <ExternalLink size={11} className="mr-1" />
                Abrir Drive
              </a>
            )}
          </>
        ) : (
          <>
            {pdf?.exportStatus === 'failed' && (
              <span
                className="inline-flex max-w-[220px] items-center gap-1 truncate rounded-md border border-red-200 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-red-700"
                title={pdf.exportError || 'Error al exportar a Drive'}
              >
                <AlertCircle size={11} />
                Drive falló
                {pdf.exportError ? `: ${pdf.exportError}` : ''}
              </span>
            )}
            <button
              type="button"
              onClick={onUploadPdf}
              disabled={isUploadingPdf}
              aria-label={pdf?.exportStatus === 'failed' ? 'Reintentar Drive' : 'Exportar a Drive'}
              className={`${btnBase} border-blue-200 text-blue-700 hover:bg-blue-50`}
            >
              {isUploadingPdf ? (
                <Loader2 size={11} className="mr-1 inline animate-spin" />
              ) : (
                <UploadCloud size={11} className="mr-1 inline" />
              )}
              {pdf?.exportStatus === 'failed' ? 'Reintentar' : 'Drive pendiente'}
            </button>
          </>
        )}
      </div>
    </div>
  );
};
