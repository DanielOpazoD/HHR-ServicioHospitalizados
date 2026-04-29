import React from 'react';
import { Calendar } from 'lucide-react';

interface LabViewerExamFiltersProps {
  filterCategories: string[];
  activeFilter: string | null;
  allSelected: boolean;
  hasSelectableExams: boolean;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (value: string) => void;
  onDateToChange: (value: string) => void;
  onFilterChange: (category: string | null) => void;
  onSelectAll: () => void;
  onSelectByDays: (days: number) => void;
  onApplyDateRange: () => void;
}

const QUICK_RANGE_OPTIONS = [
  { label: '7 dias', days: 7 },
  { label: '14 dias', days: 14 },
  { label: '1 mes', days: 30 },
  { label: '3 meses', days: 90 },
  { label: '6 meses', days: 180 },
  { label: '12 meses', days: 365 },
] as const;

export const LabViewerExamFilters: React.FC<LabViewerExamFiltersProps> = ({
  allSelected,
  hasSelectableExams,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onSelectAll,
  onSelectByDays,
  onApplyDateRange,
}) => (
  <>
    <div className="flex flex-wrap items-center justify-between gap-1.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        <div
          data-testid="lab-quick-range-group"
          className="inline-flex overflow-hidden rounded-lg border border-emerald-200 bg-white"
        >
          {QUICK_RANGE_OPTIONS.map(({ label, days }) => (
            <button
              key={label}
              type="button"
              onClick={() => onSelectByDays(days)}
              className="border-l border-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-700 transition-colors first:border-l-0 hover:bg-emerald-50"
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <Calendar size={11} className="text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={event => onDateFromChange(event.target.value)}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 focus:border-emerald-400 focus:outline-none"
          />
          <span className="text-[10px] text-slate-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={event => onDateToChange(event.target.value)}
            className="rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onApplyDateRange}
            disabled={!dateFrom || !dateTo}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
          >
            Aplicar
          </button>
        </div>
      </div>
      {hasSelectableExams ? (
        <button
          type="button"
          onClick={onSelectAll}
          className="text-[10px] font-medium text-emerald-600 hover:text-emerald-700"
        >
          {allSelected ? 'Deseleccionar todo' : 'Seleccionar todo'}
        </button>
      ) : null}
    </div>
  </>
);
