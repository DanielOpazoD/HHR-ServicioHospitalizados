/**
 * @module useLabViewer
 * @description React hook for the laboratory exam viewer modal.
 * Contains only state management and orchestration — all data transformation
 * is delegated to controllers, all constants to labConstants.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { searchSyslabExams, fetchSyslabExamDetails } from '@/services/laboratory/syslabService';
import { queryKeys } from '@/config/queryClient';
import type {
  SyslabExamItem,
  LabPatient,
  LabAnalysisData,
  AnalysisViewTab,
} from '@/types/domain/laboratory';
import type { ProgressState } from '../types/labViewerTypes';
import {
  SEARCH_STEPS,
  ANALYSIS_STEPS,
  STEP_INTERVAL_MS,
  EXAM_FILTER_CATEGORIES,
} from '../constants/labConstants';
import { bedSortKey } from '../controllers/labFormattingController';
import { buildAnalysisData } from '../controllers/labAnalyticsController';
import { saveLabResults } from '../services/labFirestoreService';

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface UseLabViewerReturn {
  uniquePatients: LabPatient[];
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
  analyzeSelected: () => Promise<void>;
  closeAnalysis: () => void;
  setAnalysisView: (tab: AnalysisViewTab) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export const useLabViewer = (
  patients: LabPatient[],
  initialPatientRut?: string
): UseLabViewerReturn => {
  const queryClient = useQueryClient();
  const [selectedRut, setSelectedRut] = useState(initialPatientRut || patients[0]?.rut || '');
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [pdfExam, setPdfExam] = useState<SyslabExamItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<LabAnalysisData | null>(null);
  const [analysisView, setAnalysisView] = useState<AnalysisViewTab>('trends');
  const [activeExamFilter, setActiveExamFilter] = useState<string | null>(null);

  // Cached exam search via TanStack Query (10 min staleTime — exams don't change often)
  const examQuery = useQuery({
    queryKey: queryKeys.laboratory.byPatient(selectedRut),
    queryFn: () => searchSyslabExams(selectedRut),
    enabled: searchEnabled && !!selectedRut,
    staleTime: 10 * 60 * 1000, // 10 min
    gcTime: 30 * 60 * 1000, // 30 min
    retry: 1,
  });

  const examList = examQuery.data?.success ? examQuery.data.data : [];
  const isLoading = examQuery.isFetching;

  // Sync query errors to local error state
  useEffect(() => {
    if (examQuery.error) {
      setError(
        examQuery.error instanceof Error ? examQuery.error.message : 'Error al buscar exámenes.'
      );
    } else if (examQuery.data && !examQuery.data.success) {
      setError(examQuery.data.error || 'No se pudieron obtener los resultados.');
    }
  }, [examQuery.error, examQuery.data]);

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Deduplicate patients by RUT and sort by bed order
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    return patients
      .filter(p => {
        if (!p.rut || seen.has(p.rut)) return false;
        seen.add(p.rut);
        return true;
      })
      .sort((a, b) => bedSortKey(a.bedId) - bedSortKey(b.bedId));
  }, [patients]);

  // Derive filter categories from exam list
  const examFilterCategories = useMemo(() => {
    const cats = new Set<string>();
    for (const exam of examList) {
      for (const examName of exam.exams) {
        const upper = examName.toUpperCase();
        const match = EXAM_FILTER_CATEGORIES.find(c => c.patterns.some(p => upper.includes(p)));
        cats.add(match?.label || 'Otros');
      }
    }
    return Array.from(cats);
  }, [examList]);

  // Filter exam list by active category
  const filteredExamList = useMemo(() => {
    if (!activeExamFilter) return examList;
    const category = EXAM_FILTER_CATEGORIES.find(c => c.label === activeExamFilter);
    if (!category) return examList;
    return examList.filter(exam =>
      exam.exams.some(name => category.patterns.some(p => name.toUpperCase().includes(p)))
    );
  }, [examList, activeExamFilter]);

  const setExamFilter = useCallback((cat: string | null) => setActiveExamFilter(cat), []);

  // Animated progress bar
  useEffect(() => {
    const active = isLoading || isAnalyzing;
    if (!active) {
      if (progress) {
        setProgress({ pct: 100, text: '¡Completado!' });
        const t = setTimeout(() => setProgress(null), 600);
        return () => clearTimeout(t);
      }
      return;
    }
    const steps = isAnalyzing ? ANALYSIS_STEPS : SEARCH_STEPS;
    let step = 0;
    setProgress(steps[0]);
    step = 1;
    const interval = setInterval(() => {
      if (step < steps.length) {
        setProgress(steps[step]);
        step++;
      } else {
        setProgress(prev =>
          prev && prev.pct < 95
            ? { pct: Math.min(prev.pct + 1, 95), text: 'Finalizando consulta...' }
            : prev
        );
      }
    }, STEP_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [isLoading, isAnalyzing]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetState = useCallback(() => {
    setSearchEnabled(false);
    setPdfExam(null);
    setError(null);
    setSelectedExamIds(new Set());
    setAnalysisData(null);
    setAnalysisView('trends');
    setActiveExamFilter(null);
  }, []);

  const selectPatient = useCallback(
    (rut: string) => {
      setSelectedRut(rut);
      resetState();
    },
    [resetState]
  );

  const search = useCallback(async () => {
    if (!selectedRut) return;
    setError(null);
    setSelectedExamIds(new Set());
    setAnalysisData(null);
    setPdfExam(null);
    setActiveExamFilter(null);
    setSearchEnabled(true);
    // If already cached, useQuery returns immediately; otherwise triggers fetch
    await queryClient.invalidateQueries({ queryKey: queryKeys.laboratory.byPatient(selectedRut) });
  }, [selectedRut, queryClient]);

  const openPdf = useCallback((exam: SyslabExamItem) => setPdfExam(exam), []);
  const closePdf = useCallback(() => setPdfExam(null), []);
  const reset = useCallback(() => {
    resetState();
    setSelectedRut(initialPatientRut || patients[0]?.rut || '');
  }, [initialPatientRut, patients, resetState]);

  // Selection
  const toggleExamSelection = useCallback((id: string) => {
    setSelectedExamIds(prev => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  }, []);

  const selectAllExams = useCallback(() => {
    const allIds = examList.filter(e => e.link).map(e => e.id);
    setSelectedExamIds(prev => (allIds.every(id => prev.has(id)) ? new Set() : new Set(allIds)));
  }, [examList]);

  const clearSelection = useCallback(() => setSelectedExamIds(new Set()), []);

  const selectByDays = useCallback(
    (days: number) => {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - days);
      cutoff.setHours(0, 0, 0, 0);
      const ids = examList
        .filter(e => {
          if (!e.link) return false;
          const m = e.date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
          if (!m) return false;
          return new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1])) >= cutoff;
        })
        .map(e => e.id);
      setSelectedExamIds(new Set(ids));
    },
    [examList]
  );

  // Analysis
  const analyzeSelected = useCallback(async () => {
    const links = examList.filter(e => selectedExamIds.has(e.id) && e.link).map(e => e.link!);
    if (links.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisData(null);
    setError(null);
    try {
      const data = await fetchSyslabExamDetails(links);
      if (!mountedRef.current) return;
      if (data.success) {
        setAnalysisData(buildAnalysisData(data.data, examList));
        setAnalysisView('trends');
        // Persist to Firestore in background (non-blocking)
        const patientName = examList[0]?.patientName || '';
        saveLabResults(selectedRut, patientName, data.data, examList);
      } else {
        setError(data.error || 'No se pudieron obtener los detalles de los exámenes.');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Error al analizar exámenes. Verifica que el servidor Syslab esté activo.'
      );
    } finally {
      if (mountedRef.current) setIsAnalyzing(false);
    }
  }, [examList, selectedExamIds, selectedRut]);

  const closeAnalysis = useCallback(() => {
    setAnalysisData(null);
    setAnalysisView('trends');
  }, []);

  return {
    uniquePatients,
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
    analyzeSelected,
    closeAnalysis,
    setAnalysisView,
  };
};
