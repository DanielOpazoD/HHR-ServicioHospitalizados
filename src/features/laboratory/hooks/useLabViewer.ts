/**
 * @module useLabViewer
 * @description React hook for the laboratory exam viewer modal.
 * Contains only state management and orchestration — all data transformation
 * is delegated to controllers, all constants to labConstants.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { searchSyslabExams, fetchSyslabExamDetails } from '@/services/laboratory/syslabService';
import type {
  SyslabExamItem,
  LabPatient,
  LabAnalysisData,
  AnalysisViewTab,
} from '@/types/domain/laboratory';
import type { ProgressState } from '../types/labViewerTypes';
import { SEARCH_STEPS, ANALYSIS_STEPS, STEP_INTERVAL_MS } from '../constants/labConstants';
import { bedSortKey } from '../controllers/labFormattingController';
import { buildAnalysisData } from '../controllers/labAnalyticsController';

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

export interface UseLabViewerReturn {
  uniquePatients: LabPatient[];
  selectedRut: string;
  isLoading: boolean;
  examList: SyslabExamItem[];
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
  const [selectedRut, setSelectedRut] = useState(initialPatientRut || patients[0]?.rut || '');
  const [isLoading, setIsLoading] = useState(false);
  const [examList, setExamList] = useState<SyslabExamItem[]>([]);
  const [pdfExam, setPdfExam] = useState<SyslabExamItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<LabAnalysisData | null>(null);
  const [analysisView, setAnalysisView] = useState<AnalysisViewTab>('trends');

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
    setExamList([]);
    setPdfExam(null);
    setError(null);
    setSelectedExamIds(new Set());
    setAnalysisData(null);
    setAnalysisView('trends');
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
    setIsLoading(true);
    resetState();
    try {
      const data = await searchSyslabExams(selectedRut);
      if (!mountedRef.current) return;
      data.success
        ? setExamList(data.data)
        : setError(data.error || 'No se pudieron obtener los resultados.');
    } catch (err) {
      if (!mountedRef.current) return;
      setError(
        err instanceof Error
          ? err.message
          : 'Error al buscar exámenes. Verifica que el servidor Syslab esté activo.'
      );
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [selectedRut, resetState]);

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
      data.success
        ? (setAnalysisData(buildAnalysisData(data.data, examList)), setAnalysisView('trends'))
        : setError(data.error || 'No se pudieron obtener los detalles de los exámenes.');
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
  }, [examList, selectedExamIds]);

  const closeAnalysis = useCallback(() => {
    setAnalysisData(null);
    setAnalysisView('trends');
  }, []);

  return {
    uniquePatients,
    selectedRut,
    isLoading,
    examList,
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
    toggleExamSelection,
    selectAllExams,
    clearSelection,
    selectByDays,
    analyzeSelected,
    closeAnalysis,
    setAnalysisView,
  };
};
