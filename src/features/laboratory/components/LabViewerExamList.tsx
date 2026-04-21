import React from 'react';
import clsx from 'clsx';
import { Calendar, Check, Clipboard, FileText } from 'lucide-react';
import type { SyslabExamItem } from '@/types/domain/laboratory';

interface LabViewerExamListProps {
  exams: SyslabExamItem[];
  selectedIds: Set<string>;
  filterCategories: string[];
  activeFilter: string | null;
  onFilterChange: (category: string | null) => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelectByDays: (days: number) => void;
  onSelectByDateRange: (from: Date, to: Date) => void;
  onViewPdf: (exam: SyslabExamItem) => void;
  onCopySummary: (exam: SyslabExamItem) => Promise<boolean>;
}

export const LabViewerExamList: React.FC<LabViewerExamListProps> = ({
  exams,
  selectedIds,
  filterCategories,
  activeFilter,
  onFilterChange,
  onToggleSelect,
  onSelectAll,
  onSelectByDays,
  onSelectByDateRange,
  onViewPdf,
  onCopySummary,
}) => {
  const [dateFrom, setDateFrom] = React.useState('');
  const [dateTo, setDateTo] = React.useState('');
  const [copiedExamId, setCopiedExamId] = React.useState<string | null>(null);
  const [copyingExamId, setCopyingExamId] = React.useState<string | null>(null);

  const selectableExams = exams.filter(e => e.link);
  const allSelected =
    selectableExams.length > 0 && selectableExams.every(e => selectedIds.has(e.id));

  const handleDateRangeSelect = () => {
    if (!dateFrom || !dateTo) return;
    const from = new Date(dateFrom);
    from.setHours(0, 0, 0, 0);
    const to = new Date(dateTo);
    to.setHours(23, 59, 59, 999);
    onSelectByDateRange(from, to);
  };

  const handleCopySummary = async (exam: SyslabExamItem) => {
    setCopyingExamId(exam.id);
    const copied = await onCopySummary(exam);
    setCopyingExamId(null);
    if (!copied) return;
    setCopiedExamId(exam.id);
    window.setTimeout(() => {
      setCopiedExamId(current => (current === exam.id ? null : current));
    }, 2000);
  };

  return (
    <div className="space-y-3 pb-24">
      <div className="flex items-center justify-between flex-wrap gap-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
              Ordenes disponibles
            </p>
            <p className="text-[12px] font-bold text-slate-700">{exams.length} examenes</p>
          </div>
          <div className="h-3 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => onSelectByDays(7)}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 hover:bg-emerald-100"
          >
            7 dias
          </button>
          <button
            type="button"
            onClick={() => onSelectByDays(14)}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 hover:bg-emerald-100"
          >
            14 dias
          </button>
          <div className="h-3 w-px bg-slate-200" />
          <div className="flex items-center gap-1">
            <Calendar size={10} className="text-slate-400" />
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="rounded border border-slate-200 px-1 py-0.5 text-[9px] text-slate-600 focus:border-emerald-400 focus:outline-none"
            />
            <span className="text-[9px] text-slate-400">—</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="rounded border border-slate-200 px-1 py-0.5 text-[9px] text-slate-600 focus:border-emerald-400 focus:outline-none"
            />
            <button
              type="button"
              onClick={handleDateRangeSelect}
              disabled={!dateFrom || !dateTo}
              className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
        </div>
        {selectableExams.length > 0 && (
          <button
            type="button"
            onClick={onSelectAll}
            className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
          >
            {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
          </button>
        )}
      </div>

      {/* Filter chips */}
      {filterCategories.length > 1 && (
        <div className="flex flex-wrap gap-1">
          <button
            type="button"
            onClick={() => onFilterChange(null)}
            className={clsx(
              'rounded-lg px-2 py-0.5 text-[9px] font-medium border transition-colors',
              !activeFilter
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
            )}
          >
            Todos
          </button>
          {filterCategories.map(cat => (
            <button
              key={cat}
              type="button"
              onClick={() => onFilterChange(activeFilter === cat ? null : cat)}
              className={clsx(
                'rounded-lg px-2 py-0.5 text-[9px] font-medium border transition-colors',
                activeFilter === cat
                  ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                  : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
              )}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-1.5">
        {exams.map((exam, index) => {
          const isSelected = selectedIds.has(exam.id);
          return (
            <div
              key={`${exam.id}-${index}`}
              className={clsx(
                'flex items-center gap-3 rounded-xl border p-3 transition-all',
                isSelected
                  ? 'border-emerald-200 bg-emerald-50/50 ring-1 ring-emerald-200/50'
                  : 'border-slate-200/80 bg-white hover:shadow-sm'
              )}
            >
              {exam.link && (
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => onToggleSelect(exam.id)}
                  className="h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
                />
              )}
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
                <div className="shrink-0 flex flex-col items-stretch gap-2">
                  <button
                    type="button"
                    onClick={() => onViewPdf(exam)}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-medium text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
                  >
                    <FileText size={12} />
                    Ver PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopySummary(exam)}
                    disabled={copyingExamId === exam.id}
                    className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-800 disabled:opacity-50"
                  >
                    {copiedExamId === exam.id ? (
                      <Check size={12} className="text-emerald-600" />
                    ) : (
                      <Clipboard size={12} />
                    )}
                    {copiedExamId === exam.id
                      ? 'Copiado'
                      : copyingExamId === exam.id
                        ? 'Copiando...'
                        : 'Copiar resumen'}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
