/**
 * ClinicalDocumentIeehPanel
 *
 * Collapsible panel rendered below the "Diagnósticos de egreso" section
 * in epicrisis documents. Allows the doctor to optionally fill the
 * statistical discharge (IEEH) while writing the epicrisis.
 *
 * Captures CIE-10 code, discharge condition, surgical intervention,
 * and procedure. Discharge time is left blank — the nurse fills it
 * when the patient physically leaves.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronDown, ClipboardList, Loader2, Printer, Search, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';

import type {
  ClinicalDocumentIeehDraft,
  ClinicalDocumentRecord,
  IeehDischargeConditionCode,
} from '@/features/clinical-documents/domain/entities';
import {
  createEmptyIeehDraft,
  IEEH_DISCHARGE_CONDITIONS,
} from '@/features/clinical-documents/controllers/clinicalDocumentIeehController';
import {
  buildIeehPatientFromEpicrisis,
  buildIeehDischargeFromEpicrisis,
  type IeehPatientSnapshot,
} from '@/features/clinical-documents/controllers/clinicalDocumentIeehPrintController';
import { FonasaSearchInput } from '@/features/clinical-documents/components/FonasaSearchInput';
import type { TerminologyConcept } from '@/services/terminology/terminologyService';
import { searchDiagnoses, forceAISearch } from '@/services/terminology/terminologyService';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Delay before triggering CIE-10 search after typing stops. */
const SEARCH_DEBOUNCE_MS = 350;

/** Delay before hiding dropdown after input blur (allows click on results). */
const BLUR_HIDE_DELAY_MS = 200;

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

/** Props for {@link ClinicalDocumentIeehPanel}. */
interface ClinicalDocumentIeehPanelProps {
  /** The parent epicrisis document (needed for patient data when printing). */
  document: ClinicalDocumentRecord;
  /** Workspace patient data (provides birthDate for IEEH PDF). */
  workspacePatient?: { birthDate?: string };
  /** Current saved draft (undefined when panel not yet opened). */
  draft: ClinicalDocumentIeehDraft | undefined;
  /** Whether the user can modify the draft. */
  canEdit: boolean;
  /** Callback to persist changes to the draft. */
  onPatchDraft: (draft: ClinicalDocumentIeehDraft) => void;
  /** Callback to remove the entire draft from the document. */
  onClearDraft: () => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

/** Collapsible IEEH panel for epicrisis documents. */
export const ClinicalDocumentIeehPanel: React.FC<ClinicalDocumentIeehPanelProps> = ({
  document: epicrisisDoc,
  workspacePatient,
  draft,
  canEdit,
  onPatchDraft,
  onClearDraft,
}) => {
  const [isOpen, setIsOpen] = useState(!!draft?.cie10Code);
  const [localDraft, setLocalDraft] = useState<ClinicalDocumentIeehDraft>(
    () => draft ?? createEmptyIeehDraft()
  );

  // CIE-10 search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<TerminologyConcept[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAiSearching, setIsAiSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const blurTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Sync from external draft when it changes (e.g. autosave round-trip or clear)
  useEffect(() => {
    setLocalDraft(draft ?? createEmptyIeehDraft());
  }, [draft]);

  // Cleanup timers and abort controllers on unmount
  useEffect(() => {
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
      if (blurTimerRef.current) clearTimeout(blurTimerRef.current);
      abortRef.current?.abort();
    };
  }, []);

  /** Persist local changes to parent via reducer dispatch. */
  const commitDraft = useCallback(
    (next: ClinicalDocumentIeehDraft) => {
      setLocalDraft(next);
      onPatchDraft(next);
    },
    [onPatchDraft]
  );

  /** Debounced CIE-10 search using the terminology service. */
  const handleSearchChange = useCallback((query: string) => {
    setSearchQuery(query);

    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    abortRef.current?.abort();

    if (query.length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setShowResults(true);
    searchTimerRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;
      setIsSearching(true);
      try {
        const results = await searchDiagnoses(query, controller.signal);
        if (!controller.signal.aborted) setSearchResults(results);
      } catch {
        // Network or abort error — reset to empty
        if (!controller.signal.aborted) setSearchResults([]);
      } finally {
        if (!controller.signal.aborted) setIsSearching(false);
      }
    }, SEARCH_DEBOUNCE_MS);
  }, []);

  /** Force AI-powered search via Gemini. */
  const handleAiSearch = useCallback(async () => {
    if (searchQuery.length < 2 || isAiSearching) return;
    setIsAiSearching(true);
    try {
      const results = await forceAISearch(searchQuery);
      setSearchResults(results);
      setShowResults(true);
    } catch {
      // AI search failed — keep existing results
    } finally {
      setIsAiSearching(false);
    }
  }, [searchQuery, isAiSearching]);

  /** Select a CIE-10 concept from search results. */
  const handleSelectDiagnosis = useCallback(
    (concept: TerminologyConcept) => {
      commitDraft({
        ...localDraft,
        cie10Code: concept.code,
        cie10Description: concept.display,
        diagnosticoPrincipal: concept.display,
      });
      setSearchQuery('');
      setShowResults(false);
      setSearchResults([]);
    },
    [localDraft, commitDraft]
  );

  /** Clear the selected CIE-10 code. */
  const handleClearDiagnosis = useCallback(() => {
    commitDraft({ ...localDraft, cie10Code: '', cie10Description: '', diagnosticoPrincipal: '' });
  }, [localDraft, commitDraft]);

  /** Type-safe generic field updater for the draft. */
  const patchField = useCallback(
    <K extends keyof ClinicalDocumentIeehDraft>(field: K, value: ClinicalDocumentIeehDraft[K]) => {
      commitDraft({ ...localDraft, [field]: value });
    },
    [localDraft, commitDraft]
  );

  const [isPrinting, setIsPrinting] = useState(false);

  /** Print the IEEH PDF using the official MINSAL template. */
  const handlePrintIeeh = useCallback(async () => {
    if (isPrinting || !localDraft.cie10Code) return;
    setIsPrinting(true);
    try {
      const { printIEEHForm } = await import('@/services/pdf/ieehPdfService');
      const patient = buildIeehPatientFromEpicrisis(epicrisisDoc, workspacePatient);
      const discharge = buildIeehDischargeFromEpicrisis({
        ...epicrisisDoc,
        ieehDraft: localDraft,
      });
      // IeehPatientSnapshot is a subset of PatientData — the PDF service
      // only reads the fields we provide; missing census-only fields
      // (bedId, isBlocked, etc.) are not used by fillIEEHForm.
      await printIEEHForm(patient as Parameters<typeof printIEEHForm>[0], discharge);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('[IEEH] Error printing from epicrisis:', error);
    } finally {
      setIsPrinting(false);
    }
  }, [isPrinting, localDraft, epicrisisDoc, workspacePatient]);

  /** Remove the entire IEEH draft from the document. */
  const handleRemovePanel = useCallback(() => {
    onClearDraft();
    setLocalDraft(createEmptyIeehDraft());
    setIsOpen(false);
  }, [onClearDraft]);

  /** Delayed hide of search results dropdown (allows click on results). */
  const handleSearchBlur = useCallback(() => {
    blurTimerRef.current = setTimeout(() => setShowResults(false), BLUR_HIDE_DELAY_MS);
  }, []);

  return (
    <div className="mt-2 rounded-lg border border-emerald-200 bg-emerald-50/40 print:hidden">
      {/* Collapse header */}
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-semibold text-emerald-800 hover:bg-emerald-50 rounded-lg transition-colors"
      >
        <ClipboardList size={14} />
        Egreso Estadístico
        <span className="text-[10px] font-normal text-emerald-600">(opcional)</span>
        {localDraft.cie10Code && (
          <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">
            {localDraft.cie10Code}
          </span>
        )}
        <ChevronDown
          size={14}
          className={clsx('ml-auto transition-transform', isOpen && 'rotate-180')}
        />
      </button>

      {/* Panel body */}
      {isOpen && canEdit && (
        <div className="space-y-3 px-3 pb-3">
          {/* ---- CIE-10 Search ---- */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Diagnóstico principal (CIE-10)
            </label>

            {localDraft.cie10Code ? (
              <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-white px-2.5 py-1.5">
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
                  {localDraft.cie10Code}
                </span>
                <span className="flex-1 text-xs text-slate-700 truncate">
                  {localDraft.cie10Description}
                </span>
                <button
                  type="button"
                  onClick={handleClearDiagnosis}
                  className="p-0.5 rounded text-slate-400 hover:text-red-500 hover:bg-red-50"
                  aria-label="Cambiar diagnóstico CIE-10"
                  title="Cambiar diagnóstico"
                >
                  <X size={12} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="flex items-center gap-1">
                  <div className="relative flex-1">
                    <Search
                      size={13}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => handleSearchChange(e.target.value)}
                      onFocus={() => searchResults.length > 0 && setShowResults(true)}
                      onBlur={handleSearchBlur}
                      placeholder="Buscar diagnóstico CIE-10..."
                      className="w-full rounded-md border border-slate-200 py-1.5 pl-7 pr-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
                    />
                    {isSearching && (
                      <Loader2
                        size={13}
                        className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-slate-400"
                      />
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={handleAiSearch}
                    disabled={searchQuery.length < 2 || isAiSearching}
                    className="flex items-center gap-1 rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-[10px] font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40 transition-colors"
                    aria-label="Buscar diagnóstico con inteligencia artificial"
                    title="Buscar con IA"
                  >
                    {isAiSearching ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    IA
                  </button>
                </div>

                {/* Search results dropdown */}
                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-30 mt-1 max-h-48 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
                    {searchResults.map(concept => (
                      <button
                        key={concept.code}
                        type="button"
                        onMouseDown={e => e.preventDefault()}
                        onClick={() => handleSelectDiagnosis(concept)}
                        className="flex w-full items-start gap-2 px-2.5 py-1.5 text-left hover:bg-emerald-50 transition-colors"
                      >
                        <span className="shrink-0 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-mono font-bold text-slate-600">
                          {concept.code}
                        </span>
                        <span className="text-xs text-slate-700 leading-snug">
                          {concept.display}
                          {concept.fromAI && (
                            <span className="ml-1 text-violet-500 text-[9px]">⚡ IA</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ---- Condición de egreso ---- */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Condición al egreso
            </label>
            <select
              value={localDraft.condicionEgreso}
              onChange={e =>
                patchField('condicionEgreso', e.target.value as IeehDischargeConditionCode)
              }
              className="w-full rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-emerald-400 focus:outline-none focus:ring-1 focus:ring-emerald-200"
            >
              {IEEH_DISCHARGE_CONDITIONS.map(opt => (
                <option key={opt.value} value={opt.value}>
                  {opt.value}. {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* ---- Intervención quirúrgica ---- */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Intervención quirúrgica
            </label>
            <div className="flex items-center gap-4 text-xs text-slate-700">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={localDraft.intervencionQuirurgica === '1'}
                  onChange={() => patchField('intervencionQuirurgica', '1')}
                  className="h-3 w-3 text-emerald-600"
                />
                Sí
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={localDraft.intervencionQuirurgica === '2'}
                  onChange={() => patchField('intervencionQuirurgica', '2')}
                  className="h-3 w-3 text-emerald-600"
                />
                No
              </label>
            </div>
            {localDraft.intervencionQuirurgica === '1' && (
              <div className="mt-1">
                <FonasaSearchInput
                  catalog="interventions"
                  code={localDraft.intervencionCodigo ?? ''}
                  description={localDraft.intervencionQuirurgDescrip ?? ''}
                  placeholder="Buscar intervención quirúrgica FONASA..."
                  onSelect={entry =>
                    commitDraft({
                      ...localDraft,
                      intervencionCodigo: entry.code,
                      intervencionQuirurgDescrip: entry.description,
                    })
                  }
                  onManualChange={text =>
                    commitDraft({
                      ...localDraft,
                      intervencionCodigo: undefined,
                      intervencionQuirurgDescrip: text,
                    })
                  }
                  onClear={() =>
                    commitDraft({
                      ...localDraft,
                      intervencionCodigo: undefined,
                      intervencionQuirurgDescrip: undefined,
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* ---- Procedimiento ---- */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              Procedimiento
            </label>
            <div className="flex items-center gap-4 text-xs text-slate-700">
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={localDraft.procedimiento === '1'}
                  onChange={() => patchField('procedimiento', '1')}
                  className="h-3 w-3 text-emerald-600"
                />
                Sí
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input
                  type="radio"
                  checked={localDraft.procedimiento === '2'}
                  onChange={() => patchField('procedimiento', '2')}
                  className="h-3 w-3 text-emerald-600"
                />
                No
              </label>
            </div>
            {localDraft.procedimiento === '1' && (
              <div className="mt-1">
                <FonasaSearchInput
                  catalog="procedures"
                  code={localDraft.procedimientoCodigo ?? ''}
                  description={localDraft.procedimientoDescrip ?? ''}
                  placeholder="Buscar procedimiento FONASA..."
                  onSelect={entry =>
                    commitDraft({
                      ...localDraft,
                      procedimientoCodigo: entry.code,
                      procedimientoDescrip: entry.description,
                    })
                  }
                  onManualChange={text =>
                    commitDraft({
                      ...localDraft,
                      procedimientoCodigo: undefined,
                      procedimientoDescrip: text,
                    })
                  }
                  onClear={() =>
                    commitDraft({
                      ...localDraft,
                      procedimientoCodigo: undefined,
                      procedimientoDescrip: undefined,
                    })
                  }
                />
              </div>
            )}
          </div>

          {/* ---- Médico tratante RUT ---- */}
          <div>
            <label className="block text-[10px] font-semibold text-slate-500 uppercase mb-1">
              RUT Médico Tratante <span className="font-normal text-slate-400">(opcional)</span>
            </label>
            <input
              type="text"
              value={localDraft.tratanteRut ?? ''}
              onChange={e => patchField('tratanteRut', e.target.value)}
              placeholder="12.345.678-9"
              className="w-48 rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-700 placeholder:text-slate-400 focus:border-emerald-400 focus:outline-none"
            />
          </div>

          {/* ---- Actions (always visible when panel is open) ---- */}
          <div className="flex items-center justify-between pt-2 border-t border-emerald-100">
            <button
              type="button"
              onClick={handlePrintIeeh}
              disabled={isPrinting || !localDraft.cie10Code}
              className="flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              title={
                localDraft.cie10Code ? 'Imprimir IEEH' : 'Seleccione un diagnóstico CIE-10 primero'
              }
            >
              {isPrinting ? <Loader2 size={13} className="animate-spin" /> : <Printer size={13} />}
              Imprimir IEEH
            </button>
            <button
              type="button"
              onClick={handleRemovePanel}
              className="text-[10px] text-red-500 hover:text-red-700 transition-colors"
            >
              Eliminar egreso estadístico
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
