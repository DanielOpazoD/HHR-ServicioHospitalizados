/**
 * @module useLabViewer
 * @description Public orchestration hook for the laboratory exam viewer modal.
 * Keeps the external contract stable while delegating search, selection, and
 * analysis responsibilities to smaller internal hooks.
 */

import { useCallback } from 'react';
import type { LabPatient, SyslabExamItem } from '@/types/domain/labExamTypes';
import type { AnalysisViewTab, LabAnalysisData } from '@/types/domain/labAnalyticsTypes';
import type { ProgressState } from '../types/labViewerTypes';
import { resolveInitialLabViewerRut } from '../controllers/labViewerController';
import { useLabViewerAnalysis } from './useLabViewerAnalysis';
import { useLabViewerQuery } from './useLabViewerQuery';
import { useLabViewerSelection } from './useLabViewerSelection';

export interface UseLabViewerReturn {
  uniquePatients: LabPatient[];
  selectedPatient: LabPatient | null;
  selectedRut: string;
  isLoading: boolean;
  examList: SyslabExamItem[];
  filteredExamList: SyslabExamItem[];
  examFilterCategories: string[];
  activeExamFilter: string | null;
  pdfExam: SyslabExamItem | null;
  error: string | null;
  progress: ProgressState | null;
  selectedExamIds: Set<string>;
  isAnalyzing: boolean;
  analysisData: LabAnalysisData | null;
  analysisView: AnalysisViewTab;
  selectPatient: (rut: string) => void;
  search: () => Promise<void>;
  openPdf: (exam: SyslabExamItem) => void;
  closePdf: () => void;
  reset: () => void;
  setExamFilter: (category: string | null) => void;
  toggleExamSelection: (id: string) => void;
  selectAllExams: () => void;
  clearSelection: () => void;
  selectByDays: (days: number) => void;
  selectByDateRange: (from: Date, to: Date) => void;
  analyzeSelected: () => Promise<void>;
  copyExamSummary: (exam: SyslabExamItem) => Promise<boolean>;
  closeAnalysis: () => void;
  setAnalysisView: (tab: AnalysisViewTab) => void;
}

export const useLabViewer = (
  patients: LabPatient[],
  initialPatientRut?: string
): UseLabViewerReturn => {
  const {
    uniquePatients,
    selectedPatient,
    selectedRut,
    isLoading,
    examList,
    pdfExam,
    error,
    setError,
    resetQueryState,
    selectPatient: selectQueryPatient,
    setSelectedRut,
    search: runSearch,
    openPdf,
    closePdf,
  } = useLabViewerQuery({
    patients,
    initialPatientRut,
  });

  const {
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
  } = useLabViewerSelection({ examList });

  const {
    progress,
    isAnalyzing,
    analysisData,
    analysisView,
    analyzeSelected,
    copyExamSummary,
    closeAnalysis,
    setAnalysisView,
    resetAnalysis,
  } = useLabViewerAnalysis({
    examList,
    selectedExamIds,
    selectedRut,
    isLoading,
    setError,
  });

  const selectPatient = useCallback(
    (rut: string) => {
      selectQueryPatient(rut);
      resetSelection();
      resetAnalysis();
    },
    [resetAnalysis, resetSelection, selectQueryPatient]
  );

  const search = useCallback(async () => {
    resetSelection();
    resetAnalysis();
    await runSearch();
  }, [resetAnalysis, resetSelection, runSearch]);

  const reset = useCallback(() => {
    resetQueryState();
    resetSelection();
    resetAnalysis();
    setSelectedRut(resolveInitialLabViewerRut(patients, initialPatientRut));
  }, [initialPatientRut, patients, resetAnalysis, resetQueryState, resetSelection, setSelectedRut]);

  return {
    uniquePatients,
    selectedPatient,
    selectedRut,
    isLoading,
    examList,
    filteredExamList,
    examFilterCategories,
    activeExamFilter,
    pdfExam,
    error,
    progress,
    selectedExamIds,
    isAnalyzing,
    analysisData,
    analysisView,
    selectPatient,
    search,
    openPdf,
    closePdf,
    reset,
    setExamFilter,
    toggleExamSelection,
    selectAllExams,
    clearSelection,
    selectByDays,
    selectByDateRange,
    analyzeSelected,
    copyExamSummary,
    closeAnalysis,
    setAnalysisView,
  };
};
