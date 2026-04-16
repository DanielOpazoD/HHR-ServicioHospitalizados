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
import { SEARCH_STEPS, ANALYSIS_STEPS, STEP_INTERVAL_MS } from '../constants/labConstants';
import { buildAnalysisData } from '../controllers/labAnalyticsController';
import {
  buildUniqueLabPatients,
  filterLabExamsByCategory,
  resolveInitialLabViewerRut,
  resolveLabExamSelectionByDateRange,
  resolveLabExamSelectionByDays,
  resolveLabExamFilterCategories,
  resolveLabViewerAnalysisErrorMessage,
  resolveLabViewerSearchErrorMessage,
  resolveSelectAllLabExamSelection,
  resolveSelectedLabAnalysisLinks,
  toggleLabExamSelection,
} from '../controllers/labViewerController';
import { saveLabResults } from '../services/labFirestoreService';
import { enrichMicrobiologyDetailsFromPdf } from '../services/labMicrobiologyPdfService';

/* ------------------------------------------------------------------ */
/*  Return type                                                        */
/* ------------------------------------------------------------------ */

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
  const [selectedRut, setSelectedRut] = useState(
    resolveInitialLabViewerRut(patients, initialPatientRut)
  );
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [pdfExam, setPdfExam] = useState<SyslabExamItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<LabAnalysisData | null>(null);
  const [analysisView, setAnalysisView] = useState<AnalysisViewTab>('trends');
  const [activeExamFilter, setActiveExamFilter] = useState<string | null>(null);
  const progressRef = useRef<ProgressState | null>(null);

  // Cached exam search via TanStack Query (10 min staleTime — exams don't change often)
  const examQuery = useQuery({
    queryKey: queryKeys.laboratory.byPatient(selectedRut),
    queryFn: () => searchSyslabExams(selectedRut),
    enabled: searchEnabled && !!selectedRut,
    staleTime: 10 * 60 * 1000, // 10 min
    gcTime: 30 * 60 * 1000, // 30 min
    retry: 1,
  });

  const examList = useMemo(
    () => (examQuery.data?.success ? examQuery.data.data : []),
    [examQuery.data]
  );
  const isLoading = examQuery.isFetching;

  // Sync query errors to local error state
  useEffect(() => {
    setError(
      resolveLabViewerSearchErrorMessage({
        queryError: examQuery.error,
        queryData: examQuery.data,
      })
    );
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
    return buildUniqueLabPatients(patients);
  }, [patients]);

  // For manual RUT searches, try to enrich from patientMaster (birthDate, etc.)
  const [manualPatientExtra, setManualPatientExtra] = useState<{
    fullName?: string;
    birthDate?: string;
  } | null>(null);

  // Fetch master data when manual RUT returns results
  useEffect(() => {
    if (!selectedRut || uniquePatients.some(p => p.rut === selectedRut)) {
      setManualPatientExtra(null);
      return;
    }
    if (examList.length === 0) return;

    let cancelled = false;
    import('@/services/repositories/PatientMasterRepository').then(({ getPatientByRut }) => {
      getPatientByRut(selectedRut).then(master => {
        if (!cancelled && master) {
          setManualPatientExtra({
            fullName: master.fullName,
            birthDate: master.birthDate,
          });
        }
      });
    });
    return () => {
      cancelled = true;
    };
  }, [selectedRut, examList.length, uniquePatients]);

  const selectedPatient = useMemo(() => {
    // 1. Try to find from census bed patients
    const fromBed = uniquePatients.find(patient => patient.rut === selectedRut);
    if (fromBed) return fromBed;

    // 2. Fallback for manual RUT search: build a synthetic patient
    //    using Syslab name + patientMaster enrichment (birthDate)
    if (selectedRut && examList.length > 0) {
      const syslabName = examList[0]?.patientName;
      return {
        bedId: '',
        label: manualPatientExtra?.fullName || syslabName || selectedRut,
        patientName: manualPatientExtra?.fullName || syslabName || '',
        rut: selectedRut,
        birthDate: manualPatientExtra?.birthDate,
      } satisfies LabPatient;
    }

    return null;
  }, [selectedRut, uniquePatients, examList, manualPatientExtra]);

  // Derive filter categories from exam list
  const examFilterCategories = useMemo(() => resolveLabExamFilterCategories(examList), [examList]);

  // Filter exam list by active category
  const filteredExamList = useMemo(
    () => filterLabExamsByCategory(examList, activeExamFilter),
    [examList, activeExamFilter]
  );

  const setExamFilter = useCallback((cat: string | null) => setActiveExamFilter(cat), []);

  useEffect(() => {
    progressRef.current = progress;
  }, [progress]);

  // Animated progress bar
  useEffect(() => {
    const active = isLoading || isAnalyzing;
    if (!active) {
      if (progressRef.current) {
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
  }, [isLoading, isAnalyzing]);

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
    setSelectedRut(resolveInitialLabViewerRut(patients, initialPatientRut));
  }, [initialPatientRut, patients, resetState]);

  // Selection
  const toggleExamSelection = useCallback((id: string) => {
    setSelectedExamIds(prev => toggleLabExamSelection(prev, id));
  }, []);

  const selectAllExams = useCallback(() => {
    setSelectedExamIds(prev =>
      resolveSelectAllLabExamSelection({
        examList,
        selectedExamIds: prev,
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

  // Analysis
  const analyzeSelected = useCallback(async () => {
    const links = resolveSelectedLabAnalysisLinks({ examList, selectedExamIds });
    if (links.length === 0) return;
    setIsAnalyzing(true);
    setAnalysisData(null);
    setError(null);
    try {
      const data = await fetchSyslabExamDetails(links);
      if (!mountedRef.current) return;
      if (data.success) {
        const enrichedDetails = await enrichMicrobiologyDetailsFromPdf(data.data, examList);
        if (!mountedRef.current) return;
        setAnalysisData(buildAnalysisData(enrichedDetails, examList));
        setAnalysisView('trends');
        // Persist to Firestore in background (non-blocking)
        const patientName = examList[0]?.patientName || '';
        saveLabResults(selectedRut, patientName, enrichedDetails, examList);
      } else {
        setError(data.error || 'No se pudieron obtener los detalles de los exámenes.');
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(resolveLabViewerAnalysisErrorMessage(err));
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
    closeAnalysis,
    setAnalysisView,
  };
};
