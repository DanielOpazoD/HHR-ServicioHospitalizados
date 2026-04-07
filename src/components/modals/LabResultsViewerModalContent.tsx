/**
 * @module LabResultsViewerModalContent
 * @description Presentational sub-components for the laboratory exam viewer modal.
 *
 * Each component is stateless and receives all data via props, making them
 * easy to test and reuse. The parent {@link LabResultsViewerModal} orchestrates
 * state via the {@link useLabViewer} hook.
 *
 * Components:
 * - {@link LabViewerControls} — Patient selector + search button
 * - {@link LabViewerProgress} — Animated progress bar
 * - {@link LabViewerExamList} — Searchable exam list with "Ver PDF" buttons
 * - {@link LabViewerPdf} — Inline PDF viewer (iframe)
 * - {@link LabViewerEmptyState} — Placeholder when no search has been performed
 */

import React from 'react';
import clsx from 'clsx';
import { ArrowLeft, FileText, FlaskConical, Loader2, Search } from 'lucide-react';
import type { SyslabExamItem, LabPatient } from '@/types/domain/laboratory';
import { buildSyslabPdfUrl } from '@/services/laboratory/syslabService';

/* ------------------------------------------------------------------ */
/*  Controls — patient selector + search button                        */
/* ------------------------------------------------------------------ */

interface LabViewerControlsProps {
  uniquePatients: LabPatient[];
  selectedRut: string;
  isLoading: boolean;
  onPatientChange: (rut: string) => void;
  onSearch: () => void;
}

export const LabViewerControls: React.FC<LabViewerControlsProps> = ({
  uniquePatients,
  selectedRut,
  isLoading,
  onPatientChange,
  onSearch,
}) => (
  <div className="mb-4 space-y-2">
    <div className="flex items-center gap-2">
      <div className="flex flex-1 items-center gap-2">
        <label className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Paciente
        </label>
        <select
          value={selectedRut}
          onChange={e => onPatientChange(e.target.value)}
          className="flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2 text-[13px] text-slate-700 shadow-sm focus:border-emerald-400 focus:outline-none focus:ring-4 focus:ring-emerald-500/10"
        >
          {uniquePatients.map(patient => (
            <option key={patient.bedId} value={patient.rut}>
              {patient.label} ({patient.rut})
            </option>
          ))}
        </select>
      </div>
      <button
        onClick={onSearch}
        disabled={!selectedRut || isLoading}
        className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-2 text-[13px] font-semibold text-white shadow-md shadow-emerald-600/25 transition-all hover:from-emerald-600 hover:to-emerald-700 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50"
      >
        {isLoading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
        Buscar
      </button>
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  Progress bar                                                       */
/* ------------------------------------------------------------------ */

interface LabViewerProgressProps {
  progress: { pct: number; text: string } | null;
}

export const LabViewerProgress: React.FC<LabViewerProgressProps> = ({ progress }) =>
  progress ? (
    <div className="mb-4">
      <div className="h-[3px] w-full overflow-hidden rounded-full bg-slate-200/80">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-[width] duration-500 ease-out"
          style={{ width: `${progress.pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-center text-[11px] text-slate-400">{progress.text}</p>
    </div>
  ) : null;

/* ------------------------------------------------------------------ */
/*  Exam list — cards with "Ver PDF" button                            */
/* ------------------------------------------------------------------ */

interface LabViewerExamListProps {
  exams: SyslabExamItem[];
  onViewPdf: (exam: SyslabExamItem) => void;
}

export const LabViewerExamList: React.FC<LabViewerExamListProps> = ({ exams, onViewPdf }) => (
  <div className="space-y-3">
    <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
      {exams.length} exámenes encontrados
    </p>

    <div className="space-y-1.5">
      {exams.map((exam, index) => (
        <div
          key={`${exam.id}-${index}`}
          className={clsx(
            'flex items-center gap-3 rounded-xl border p-3 transition-all',
            'border-slate-200/80 bg-white hover:shadow-sm'
          )}
        >
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-slate-700">{exam.date}</span>
              {exam.time && <span className="text-[11px] text-slate-400">{exam.time}</span>}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
                #{exam.id}
              </span>
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-1">
              {exam.exams.map((name, i) => (
                <span
                  key={i}
                  className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100"
                >
                  {name}
                </span>
              ))}
            </div>
          </div>
          {exam.link && (
            <button
              type="button"
              onClick={() => onViewPdf(exam)}
              className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
            >
              <FileText size={12} />
              Ver PDF
            </button>
          )}
        </div>
      ))}
    </div>
  </div>
);

/* ------------------------------------------------------------------ */
/*  PDF viewer — inline iframe with loading overlay                    */
/* ------------------------------------------------------------------ */

interface LabViewerPdfProps {
  exam: SyslabExamItem;
  onBack: () => void;
}

export const LabViewerPdf: React.FC<LabViewerPdfProps> = ({ exam, onBack }) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const pdfUrl = exam.link ? `${buildSyslabPdfUrl(exam.link)}#navpanes=0&scrollbar=1&zoom=110` : '';

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
        >
          <ArrowLeft size={14} />
          Volver a lista de exámenes
        </button>
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-semibold text-slate-600">
            {exam.date} {exam.time}
          </span>
          <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
            #{exam.id}
          </span>
        </div>
      </div>

      <div className="relative rounded-xl border border-slate-200/80 bg-white overflow-hidden">
        {isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 z-10">
            <Loader2 size={24} className="animate-spin text-emerald-500 mb-2" />
            <p className="text-[12px] text-slate-400">Obteniendo PDF desde Syslab...</p>
            <p className="text-[10px] text-slate-300 mt-1">Esto puede tardar unos segundos</p>
          </div>
        )}
        <iframe
          src={pdfUrl}
          title={`PDF Examen ${exam.id}`}
          className="w-full border-0"
          style={{ height: '80vh' }}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Empty state — shown before first search                            */
/* ------------------------------------------------------------------ */

export const LabViewerEmptyState: React.FC = () => (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <span className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-300">
      <FlaskConical size={26} />
    </span>
    <p className="text-[13px] font-medium text-slate-400">Selecciona un paciente y busca</p>
    <p className="mt-0.5 text-[11px] text-slate-300">
      Los exámenes de laboratorio Syslab se mostrarán aquí
    </p>
  </div>
);
