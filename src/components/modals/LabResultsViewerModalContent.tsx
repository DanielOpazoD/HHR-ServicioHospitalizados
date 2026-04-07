import React from 'react';
import clsx from 'clsx';
import {
  ArrowLeft,
  FileText,
  FlaskConical,
  Loader2,
  Search,
  ChevronDown,
  ChevronRight,
  Printer,
} from 'lucide-react';
import type { SyslabExamItem, SyslabExamDetail, LabResultRow } from '@/types/domain/laboratory';
import { buildSyslabPdfUrl } from '@/services/laboratory/syslabService';

/* ------------------------------------------------------------------ */
/*  Shared patient interface (same shape as radiology viewer)          */
/* ------------------------------------------------------------------ */

interface LabPatient {
  bedId: string;
  label: string;
  patientName: string;
  rut: string;
  diagnosis?: string;
}

/* ------------------------------------------------------------------ */
/*  Controls                                                           */
/* ------------------------------------------------------------------ */

interface LabViewerControlsProps {
  uniquePatients: LabPatient[];
  selectedRut: string;
  isLoading: boolean;
  onPatientChange: (rut: string) => void;
  onSearch: () => void;
}

export const LabViewerControls = ({
  uniquePatients,
  selectedRut,
  isLoading,
  onPatientChange,
  onSearch,
}: LabViewerControlsProps) => (
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

export const LabViewerProgress = ({
  progress,
}: {
  progress: { pct: number; text: string } | null;
}) =>
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
/*  Exam list (phase 1 results – checkboxes)                           */
/* ------------------------------------------------------------------ */

interface LabViewerExamListProps {
  exams: SyslabExamItem[];
  selectedLinks: Set<string>;
  onToggle: (link: string) => void;
  onToggleAll: () => void;
  onFetchDetails: () => void;
  onViewPdf: (exam: SyslabExamItem) => void;
  isLoadingDetails: boolean;
}

export const LabViewerExamList = ({
  exams,
  selectedLinks,
  onToggle,
  onToggleAll,
  onFetchDetails,
  onViewPdf,
  isLoadingDetails,
}: LabViewerExamListProps) => {
  const selectableExams = exams.filter(e => e.link);
  const allSelected =
    selectableExams.length > 0 && selectableExams.every(e => selectedLinks.has(e.link!));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          {exams.length} exámenes encontrados
        </p>
        {selectableExams.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleAll}
              className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
            >
              {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
            </button>
            <button
              onClick={onFetchDetails}
              disabled={selectedLinks.size === 0 || isLoadingDetails}
              className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 transition-colors hover:bg-emerald-100 disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoadingDetails ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <FlaskConical size={12} />
              )}
              Ver Resultados ({selectedLinks.size})
            </button>
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {exams.map((exam, index) => (
          <label
            key={`${exam.id}-${index}`}
            className={clsx(
              'flex items-center gap-3 rounded-xl border p-3 transition-all cursor-pointer',
              exam.link && selectedLinks.has(exam.link)
                ? 'border-emerald-200 bg-emerald-50/50 ring-1 ring-emerald-200/50'
                : 'border-slate-200/80 bg-white hover:shadow-sm'
            )}
          >
            <input
              type="checkbox"
              checked={!!exam.link && selectedLinks.has(exam.link)}
              onChange={() => exam.link && onToggle(exam.link)}
              disabled={!exam.link}
              className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
            />
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
                onClick={e => {
                  e.preventDefault();
                  e.stopPropagation();
                  onViewPdf(exam);
                }}
                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
              >
                <FileText size={12} />
                Ver PDF
              </button>
            )}
          </label>
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Helper: parse reference range and check if result is out of range  */
/* ------------------------------------------------------------------ */

const parseRefRange = (refValue: string): { min: number; max: number } | null => {
  const match = refValue.match(/([\d.,]+)\s*[-–]\s*([\d.,]+)/);
  if (!match) return null;
  const min = parseFloat(match[1].replace(',', '.'));
  const max = parseFloat(match[2].replace(',', '.'));
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
};

const isOutOfRange = (result: string, refValue: string): boolean | null => {
  const range = parseRefRange(refValue);
  if (!range) return null;
  const val = parseFloat(result.replace(',', '.'));
  if (isNaN(val)) return null;
  return val < range.min || val > range.max;
};

/* ------------------------------------------------------------------ */
/*  Results (phase 2 – grouped by section)                             */
/* ------------------------------------------------------------------ */

const LabResultSection = ({
  sectionName,
  rows,
  defaultOpen,
}: {
  sectionName: string;
  rows: LabResultRow[];
  defaultOpen: boolean;
}) => {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(prev => !prev)}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-slate-50"
      >
        {isOpen ? (
          <ChevronDown size={14} className="text-slate-400" />
        ) : (
          <ChevronRight size={14} className="text-slate-400" />
        )}
        <span className="text-[12px] font-bold uppercase tracking-wide text-slate-600">
          {sectionName}
        </span>
        <span className="text-[10px] text-slate-400">({rows.length})</span>
      </button>

      {isOpen && (
        <div className="border-t border-slate-100">
          <table className="w-full">
            <thead>
              <tr className="text-left text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                <th className="px-4 py-2">Variable</th>
                <th className="px-4 py-2">Resultado</th>
                <th className="px-4 py-2">Unidad</th>
                <th className="px-4 py-2">Ref.</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const outOfRange = isOutOfRange(row.result, row.refValue);
                return (
                  <tr
                    key={i}
                    className="border-t border-slate-50 transition-colors hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-2 text-[12px] font-medium text-slate-700">
                      {row.analysis}
                    </td>
                    <td
                      className={clsx(
                        'px-4 py-2 text-[12px] font-bold',
                        outOfRange === true && 'text-red-600',
                        outOfRange === false && 'text-emerald-600',
                        outOfRange === null && 'text-slate-800'
                      )}
                    >
                      {row.result}
                    </td>
                    <td className="px-4 py-2 text-[11px] text-slate-500">{row.unit}</td>
                    <td className="px-4 py-2 text-[11px] text-slate-400">{row.refValue}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

interface LabViewerResultsProps {
  details: SyslabExamDetail[];
  exams: SyslabExamItem[];
}

export const LabViewerResults = ({ details, exams }: LabViewerResultsProps) => {
  if (details.length === 0) return null;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
          Resultados de laboratorio
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50"
        >
          <Printer size={12} />
          Imprimir
        </button>
      </div>

      {details.map((detail, detailIdx) => {
        const matchingExam = exams.find(e => e.link === detail.url);

        // Group findings by section
        const sections: Record<string, LabResultRow[]> = {};
        for (const finding of detail.findings) {
          const key = finding.section || 'GENERAL';
          if (!sections[key]) sections[key] = [];
          sections[key].push(finding);
        }

        const sectionKeys = Object.keys(sections);

        return (
          <div key={detailIdx} className="space-y-2">
            {/* Exam header */}
            <div className="flex items-center justify-between rounded-xl bg-emerald-50/50 border border-emerald-100 px-4 py-2.5">
              <div>
                <span className="text-[13px] font-semibold text-slate-700">
                  Atención: {matchingExam?.date || 'Fecha desconocida'}
                </span>
                {matchingExam?.time && (
                  <span className="ml-2 text-[11px] text-slate-400">{matchingExam.time}</span>
                )}
              </div>
              {matchingExam?.id && (
                <span className="rounded-lg bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-700">
                  ID: {matchingExam.id}
                </span>
              )}
            </div>

            {detail.findings.length === 0 ? (
              <div className="rounded-xl border border-slate-200/80 bg-white px-4 py-6 text-center">
                <p className="text-[12px] text-slate-400">
                  {detail.error
                    ? `Error: ${detail.error}`
                    : 'No se pudieron detectar resultados numéricos estructurados.'}
                </p>
              </div>
            ) : (
              sectionKeys.map((sectionName, secIdx) => (
                <LabResultSection
                  key={sectionName}
                  sectionName={sectionName}
                  rows={sections[sectionName]}
                  defaultOpen={secIdx === 0}
                />
              ))
            )}
          </div>
        );
      })}
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  PDF viewer (inline iframe)                                         */
/* ------------------------------------------------------------------ */

interface LabViewerPdfProps {
  exam: SyslabExamItem;
  onBack: () => void;
}

export const LabViewerPdf = ({ exam, onBack }: LabViewerPdfProps) => {
  const [isLoading, setIsLoading] = React.useState(true);
  const pdfUrl = exam.link ? buildSyslabPdfUrl(exam.link) : '';

  return (
    <div className="space-y-3">
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

      <div className="flex flex-wrap gap-1 mb-2">
        {exam.exams.map((name, i) => (
          <span
            key={i}
            className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 border border-emerald-100"
          >
            {name}
          </span>
        ))}
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
          style={{ height: '70vh' }}
          onLoad={() => setIsLoading(false)}
        />
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Empty state                                                        */
/* ------------------------------------------------------------------ */

export const LabViewerEmptyState = () => (
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
