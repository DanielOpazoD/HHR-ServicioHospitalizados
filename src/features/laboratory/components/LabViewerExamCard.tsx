import React from 'react';
import clsx from 'clsx';
import { Check, Clipboard, FileText } from 'lucide-react';
import type { SyslabExamItem } from '@/types/domain/laboratory';

interface LabViewerExamCardProps {
  exam: SyslabExamItem;
  isSelected: boolean;
  copiedExamId: string | null;
  copyingExamId: string | null;
  onToggleSelect: (id: string) => void;
  onViewPdf: (exam: SyslabExamItem) => void;
  onCopySummary: (exam: SyslabExamItem) => void;
}

export const LabViewerExamCard: React.FC<LabViewerExamCardProps> = ({
  exam,
  isSelected,
  copiedExamId,
  copyingExamId,
  onToggleSelect,
  onViewPdf,
  onCopySummary,
}) => (
  <div
    className={clsx(
      'flex items-start gap-3 rounded-xl border p-3 transition-all',
      isSelected
        ? 'border-emerald-200 bg-emerald-50/50 ring-1 ring-emerald-200/50'
        : 'border-slate-200/80 bg-white hover:shadow-sm'
    )}
  >
    {exam.link ? (
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => onToggleSelect(exam.id)}
        className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/20"
      />
    ) : null}
    <div className="flex-1 min-w-0">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <span className="text-[15px] font-bold text-slate-800">{exam.date}</span>
        {exam.time ? (
          <span className="text-[11px] font-medium text-slate-400">{exam.time}</span>
        ) : null}
        <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">
          #{exam.id}
        </span>
      </div>
      <div className="mt-1.5 flex flex-wrap items-center gap-1">
        {exam.exams.map((name, index) => (
          <span
            key={`${exam.id}-${index}-${name}`}
            className="rounded-md border border-emerald-100 bg-emerald-50/70 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700"
          >
            {name}
          </span>
        ))}
      </div>
    </div>
    {exam.link ? (
      <div className="shrink-0 flex min-w-[122px] flex-col items-stretch gap-1.5">
        <button
          type="button"
          onClick={() => onViewPdf(exam)}
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-emerald-700 transition-colors hover:bg-emerald-50 hover:text-emerald-800"
        >
          <FileText size={12} />
          Ver PDF
        </button>
        <button
          type="button"
          onClick={() => onCopySummary(exam)}
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
    ) : null}
  </div>
);
