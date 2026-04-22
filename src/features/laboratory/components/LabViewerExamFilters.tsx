import React from 'react';
import clsx from 'clsx';
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

export const LabViewerExamFilters: React.FC<LabViewerExamFiltersProps> = ({
  filterCategories,
  activeFilter,
  allSelected,
  hasSelectableExams,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onFilterChange,
  onSelectAll,
  onSelectByDays,
  onApplyDateRange,
}) => (
  <>
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="h-3 w-px bg-slate-200" />
        <button
          type="button"
          onClick={() => onSelectByDays(7)}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
        >
          7 dias
        </button>
        <button
          type="button"
          onClick={() => onSelectByDays(14)}
          className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100"
        >
          14 dias
        </button>
        <div className="h-3 w-px bg-slate-200" />
        <div className="flex flex-wrap items-center gap-1">
          <Calendar size={11} className="text-slate-400" />
          <input
            type="date"
            value={dateFrom}
            onChange={event => onDateFromChange(event.target.value)}
            className="rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600 focus:border-emerald-400 focus:outline-none"
          />
          <span className="text-[10px] text-slate-400">—</span>
          <input
            type="date"
            value={dateTo}
            onChange={event => onDateToChange(event.target.value)}
            className="rounded border border-slate-200 px-1.5 py-1 text-[10px] text-slate-600 focus:border-emerald-400 focus:outline-none"
          />
          <button
            type="button"
            onClick={onApplyDateRange}
            disabled={!dateFrom || !dateTo}
            className="rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 disabled:opacity-40"
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

    {filterCategories.length > 1 ? (
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onFilterChange(null)}
          className={clsx(
            'rounded-lg px-2 py-1 text-[10px] font-medium border transition-colors',
            !activeFilter
              ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
              : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
          )}
        >
          Todos
        </button>
        {filterCategories.map(category => (
          <button
            key={category}
            type="button"
            onClick={() => onFilterChange(activeFilter === category ? null : category)}
            className={clsx(
              'rounded-lg px-2 py-1 text-[10px] font-medium border transition-colors',
              activeFilter === category
                ? 'bg-emerald-100 text-emerald-700 border-emerald-300'
                : 'bg-white text-slate-400 border-slate-200 hover:bg-slate-50'
            )}
          >
            {category}
          </button>
        ))}
      </div>
    ) : null}
  </>
);
