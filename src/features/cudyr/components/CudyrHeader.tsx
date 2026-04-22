/**
 * CudyrHeader
 *
 * Top section of the CUDYR view with clear visual hierarchy:
 *  1. Title row — instrument name + date, prominent back button
 *  2. Stats bar — occupancy metrics, non-zero category pills, actions
 */

import React, { useState } from 'react';
import { ArrowLeft, FileSpreadsheet, FileText, Loader2 } from 'lucide-react';
import clsx from 'clsx';
import { PdfViewerModal } from '@/components/shared/PdfViewerModal';
import { formatTimeHHMM } from '@/utils/dateDisplayUtils';
import { cudyrExportLogger } from '@/services/cudyr/cudyrLoggers';
import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntimeCore';
import type { CategoryCounts, CudyrCategory } from '@/services/cudyr/cudyrSummary';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const CUDYR_INSTRUMENT_PDF_PATH = '/docs/instrumento-cudyr.pdf';

const ALL_CATEGORIES: CudyrCategory[] = [
  'A1',
  'A2',
  'A3',
  'B1',
  'B2',
  'B3',
  'C1',
  'C2',
  'C3',
  'D1',
  'D2',
  'D3',
];

const CATEGORY_COLORS: Record<string, string> = {
  A: 'bg-rose-100 text-rose-700 border-rose-200',
  B: 'bg-amber-100 text-amber-700 border-amber-200',
  C: 'bg-sky-100 text-sky-700 border-sky-200',
  D: 'bg-emerald-100 text-emerald-700 border-emerald-200',
};

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CudyrHeaderProps {
  occupiedCount: number;
  categorizedCount: number;
  currentDate?: string;
  updatedAt?: string;
  /** Category counts by bed type (UTI + Media combined for display). */
  categoryCounts?: CategoryCounts;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatHeaderDate = (dateString?: string): string => {
  if (!dateString) return '';
  const [year, month, day] = dateString.split('-');
  if (!year || !month || !day) return dateString;
  return `${day}-${month}-${year}`;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const CudyrHeader: React.FC<CudyrHeaderProps> = ({
  occupiedCount,
  categorizedCount,
  currentDate,
  updatedAt,
  categoryCounts,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isInstrumentOpen, setIsInstrumentOpen] = useState(false);

  const categorizationIndex =
    occupiedCount > 0 ? Math.round((categorizedCount / occupiedCount) * 100) : 0;

  const handleExportExcel = async () => {
    if (!currentDate || isExporting) return;
    setIsExporting(true);
    try {
      const [year, month] = currentDate.split('-').map(Number);
      const { generateCudyrMonthlyExcel } = await import('@/services/cudyr/cudyrExportService');
      await generateCudyrMonthlyExcel(year, month, currentDate);
    } catch (error) {
      cudyrExportLogger.error('Error exporting monthly CUDYR Excel', error);
      defaultBrowserWindowRuntime.alert(
        'Error al exportar el resumen mensual CUDYR. Por favor intente nuevamente.'
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleBackToNightShift = () => {
    window.dispatchEvent(new CustomEvent('navigate-module', { detail: 'NURSING_HANDOFF' }));
    window.dispatchEvent(new CustomEvent('set-shift', { detail: 'night' }));
  };

  // Merge UTI + Media counts for the combined category display
  const mergedCategoryCounts: Record<CudyrCategory, number> | null = categoryCounts
    ? (Object.fromEntries(
        ALL_CATEGORIES.map(cat => [
          cat,
          (categoryCounts.uti[cat] || 0) + (categoryCounts.media[cat] || 0),
        ])
      ) as Record<CudyrCategory, number>)
    : null;

  const nonZeroCategories = mergedCategoryCounts
    ? ALL_CATEGORIES.filter(cat => mergedCategoryCounts[cat] > 0)
    : [];

  return (
    <>
      {/* ================================================================= */}
      {/* Row 1 — Title + Back button                                       */}
      {/* ================================================================= */}
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 className="text-lg font-bold text-slate-800">
          Instrumento CUDYR
          {currentDate && (
            <span className="ml-2 text-slate-500 font-semibold">
              {formatHeaderDate(currentDate)}
            </span>
          )}
        </h2>

        <button
          onClick={handleBackToNightShift}
          className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 transition-colors hover:bg-indigo-100"
          title="Volver a Entrega de Turno Noche"
        >
          <ArrowLeft size={14} />
          Volver a Turno Noche
        </button>
      </div>

      {/* ================================================================= */}
      {/* Row 2 — Stats + Categories + Actions (compact single bar)         */}
      {/* ================================================================= */}
      <div className="flex flex-wrap items-center gap-2 mb-4 rounded-lg border border-slate-200 bg-slate-50/80 px-3 py-2">
        {/* Metrics */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-600">
            Ocupadas <b className="text-sm text-slate-800">{occupiedCount}</b>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">
            Categorizadas <b className="text-sm text-slate-800">{categorizedCount}</b>
          </span>
          <span className="text-slate-300">|</span>
          <span className="text-slate-600">
            Índice{' '}
            <b
              className={clsx(
                'text-sm',
                categorizationIndex === 100 ? 'text-emerald-600' : 'text-slate-800'
              )}
            >
              {categorizationIndex}%
            </b>
          </span>
        </div>

        {/* Category pills (non-zero only) */}
        {nonZeroCategories.length > 0 && mergedCategoryCounts && (
          <>
            <span className="text-slate-300">|</span>
            <div className="flex items-center gap-1">
              {nonZeroCategories.map(cat => (
                <span
                  key={cat}
                  className={clsx(
                    'inline-flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10px] font-bold',
                    CATEGORY_COLORS[cat[0]]
                  )}
                >
                  {cat}
                  <span className="opacity-80">{mergedCategoryCounts[cat]}</span>
                </span>
              ))}
            </div>
          </>
        )}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Last modified */}
        {updatedAt && (
          <span className="text-[10px] text-slate-400" title={`Última modificación CUDYR`}>
            Últ. mod. {formatTimeHHMM(updatedAt)}
          </span>
        )}

        {/* View instrument button */}
        <button
          type="button"
          onClick={() => setIsInstrumentOpen(true)}
          className="flex items-center gap-1 rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700 transition-colors hover:bg-sky-100"
          title="Ver Instrumento CUDYR (PDF)"
        >
          <FileText size={13} />
          Ver Instrumento
        </button>

        {/* Excel export */}
        {currentDate && (
          <button
            onClick={handleExportExcel}
            disabled={isExporting}
            className={clsx(
              'flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-bold transition-all',
              isExporting
                ? 'bg-slate-100 text-slate-400 cursor-wait'
                : 'bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95'
            )}
            title="Exportar resumen mensual CUDYR"
          >
            {isExporting ? (
              <>
                <Loader2 size={13} className="animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <FileSpreadsheet size={13} />
                Excel mensual
              </>
            )}
          </button>
        )}
      </div>

      {/* PDF viewer modal */}
      {isInstrumentOpen && (
        <PdfViewerModal
          fileName="Instrumento CUDYR"
          url={CUDYR_INSTRUMENT_PDF_PATH}
          onClose={() => setIsInstrumentOpen(false)}
        />
      )}
    </>
  );
};
