import { useState, useMemo, useCallback } from 'react';
import type { SyslabExamItem } from '@/types/domain/laboratory';
import {
  filterLabExamsByCategory,
  resolveLabExamFilterCategories,
  resolveLabExamSelectionByDateRange,
  resolveLabExamSelectionByDays,
  resolveSelectAllLabExamSelection,
  toggleLabExamSelection,
} from '../controllers/labViewerController';

interface UseLabViewerSelectionParams {
  examList: SyslabExamItem[];
}

export interface UseLabViewerSelectionReturn {
  filteredExamList: SyslabExamItem[];
  examFilterCategories: string[];
  activeExamFilter: string | null;
  selectedExamIds: Set<string>;
  setExamFilter: (category: string | null) => void;
  toggleExamSelection: (id: string) => void;
  selectAllExams: () => void;
  clearSelection: () => void;
  selectByDays: (days: number) => void;
  selectByDateRange: (from: Date, to: Date) => void;
  resetSelection: () => void;
}

export const useLabViewerSelection = ({
  examList,
}: UseLabViewerSelectionParams): UseLabViewerSelectionReturn => {
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set());
  const [activeExamFilter, setActiveExamFilter] = useState<string | null>(null);

  const examFilterCategories = useMemo(() => resolveLabExamFilterCategories(examList), [examList]);
  const filteredExamList = useMemo(
    () => filterLabExamsByCategory(examList, activeExamFilter),
    [examList, activeExamFilter]
  );

  const setExamFilter = useCallback((category: string | null) => setActiveExamFilter(category), []);

  const toggleExamSelection = useCallback((id: string) => {
    setSelectedExamIds(previousSelection => toggleLabExamSelection(previousSelection, id));
  }, []);

  const selectAllExams = useCallback(() => {
    setSelectedExamIds(previousSelection =>
      resolveSelectAllLabExamSelection({
        examList,
        selectedExamIds: previousSelection,
      })
    );
  }, [examList]);

  const clearSelection = useCallback(() => setSelectedExamIds(new Set()), []);

  const selectByDays = useCallback(
    (days: number) => {
      setSelectedExamIds(
        resolveLabExamSelectionByDays({
          examList,
          days,
        })
      );
    },
    [examList]
  );

  const selectByDateRange = useCallback(
    (from: Date, to: Date) => {
      setSelectedExamIds(
        resolveLabExamSelectionByDateRange({
          examList,
          from,
          to,
        })
      );
    },
    [examList]
  );

  const resetSelection = useCallback(() => {
    setSelectedExamIds(new Set());
    setActiveExamFilter(null);
  }, []);

  return {
    filteredExamList,
    examFilterCategories,
    activeExamFilter,
    selectedExamIds,
    setExamFilter,
    toggleExamSelection,
    selectAllExams,
    clearSelection,
    selectByDays,
    selectByDateRange,
    resetSelection,
  };
};
