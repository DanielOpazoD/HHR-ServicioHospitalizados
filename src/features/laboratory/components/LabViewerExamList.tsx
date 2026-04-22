import React from 'react';
import type { SyslabExamItem } from '@/types/domain/labExamTypes';
import {
  resolveAllSelectableExamsSelected,
  resolveLabExamDateRange,
  resolveSelectableLabExams,
} from '../controllers/labExamListController';
import { LabViewerExamCard } from './LabViewerExamCard';
import { LabViewerExamFilters } from './LabViewerExamFilters';

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

  const selectableExams = resolveSelectableLabExams(exams);
  const allSelected = resolveAllSelectableExamsSelected(exams, selectedIds);

  const handleDateRangeSelect = () => {
    const range = resolveLabExamDateRange(dateFrom, dateTo);
    if (!range) return;
    onSelectByDateRange(range.from, range.to);
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
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-600">
              Ordenes disponibles
            </p>
            <p className="text-[13px] font-bold text-slate-700">{exams.length} examenes</p>
          </div>
        </div>
      </div>

      <LabViewerExamFilters
        filterCategories={filterCategories}
        activeFilter={activeFilter}
        allSelected={allSelected}
        hasSelectableExams={selectableExams.length > 0}
        dateFrom={dateFrom}
        dateTo={dateTo}
        onDateFromChange={setDateFrom}
        onDateToChange={setDateTo}
        onFilterChange={onFilterChange}
        onSelectAll={onSelectAll}
        onSelectByDays={onSelectByDays}
        onApplyDateRange={handleDateRangeSelect}
      />

      <div className="space-y-2">
        {exams.map((exam, index) => {
          const isSelected = selectedIds.has(exam.id);
          return (
            <LabViewerExamCard
              key={`${exam.id}-${index}`}
              exam={exam}
              isSelected={isSelected}
              copiedExamId={copiedExamId}
              copyingExamId={copyingExamId}
              onToggleSelect={onToggleSelect}
              onViewPdf={onViewPdf}
              onCopySummary={handleCopySummary}
            />
          );
        })}
      </div>
    </div>
  );
};
