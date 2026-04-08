import React from 'react';
import clsx from 'clsx';
import { FileText } from 'lucide-react';
import type { SyslabExamItem } from '@/types/domain/laboratory';

interface LabViewerExamListProps {
  exams: SyslabExamItem[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onSelectByDays: (days: number) => void;
  onViewPdf: (exam: SyslabExamItem) => void;
}

export const LabViewerExamList: React.FC<LabViewerExamListProps> = ({
  exams,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onSelectByDays,
  onViewPdf,
}) => {
  const selectableExams = exams.filter(e => e.link);
  const allSelected =
    selectableExams.length > 0 && selectableExams.every(e => selectedIds.has(e.id));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-slate-400">
            {exams.length} examenes
          </p>
          <div className="h-3 w-px bg-slate-200" />
          <button
            type="button"
            onClick={() => onSelectByDays(7)}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Ultimos 7 dias
          </button>
          <button
            type="button"
            onClick={() => onSelectByDays(14)}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-medium text-emerald-700 hover:bg-emerald-100"
          >
            Ultimos 14 dias
          </button>
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
          );
        })}
      </div>
    </div>
  );
};
