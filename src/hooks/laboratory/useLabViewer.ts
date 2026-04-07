/**
 * @module useLabViewer
 * @description React hook that encapsulates all state and logic for the
 * laboratory exam viewer modal, including exam search, PDF viewing,
 * exam selection, and analytics processing.
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { searchSyslabExams, fetchSyslabExamDetails } from '@/services/laboratory/syslabService';
import type {
  SyslabExamItem,
  SyslabExamDetail,
  LabPatient,
  LabAnalysisData,
  LabTrendPoint,
  LabResultRow,
  LabSummaryRow,
  AnalysisViewTab,
} from '@/types/domain/laboratory';

/* ------------------------------------------------------------------ */
/*  Progress bar steps                                                 */
/* ------------------------------------------------------------------ */

interface ProgressState {
  pct: number;
  text: string;
}

const SEARCH_STEPS: ProgressState[] = [
  { pct: 10, text: 'Conectando con servidor de laboratorio...' },
  { pct: 30, text: 'Iniciando sesión en Syslab...' },
  { pct: 50, text: 'Buscando exámenes del paciente...' },
  { pct: 70, text: 'Extrayendo lista de órdenes...' },
  { pct: 85, text: 'Procesando resultados...' },
];

const ANALYSIS_STEPS: ProgressState[] = [
  { pct: 10, text: 'Conectando con Syslab...' },
  { pct: 25, text: 'Abriendo informes PDF...' },
  { pct: 45, text: 'Extrayendo datos de laboratorio...' },
  { pct: 65, text: 'Parseando resultados numéricos...' },
  { pct: 80, text: 'Construyendo tablas y tendencias...' },
  { pct: 90, text: 'Finalizando análisis...' },
];

const STEP_INTERVAL_MS = 2500;

/* ------------------------------------------------------------------ */
/*  Pure helpers                                                       */
/* ------------------------------------------------------------------ */

/**
 * Parse a reference range string into numeric min/max bounds.
 * Handles formats like "12.0-16.0", "4.5 - 11.0", "70 - 100".
 */
export const parseRefRange = (refValue: string): { min: number; max: number } | null => {
  const match = refValue.match(/([\d.,]+)\s*[-–]\s*([\d.,]+)/);
  if (!match) return null;
  const min = parseFloat(match[1].replace(',', '.'));
  const max = parseFloat(match[2].replace(',', '.'));
  if (isNaN(min) || isNaN(max)) return null;
  return { min, max };
};

/**
 * Convert DD/MM/YYYY date string to ISO YYYY-MM-DD for sorting.
 */
export const parseDateDDMMYYYY = (date: string): string => {
  const match = date.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return date;
  return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
};

/**
 * Check if a result value is outside the reference range.
 * Returns `true` if out of range, `false` if within range, `null` if unparseable.
 */
export const isOutOfRange = (result: string, refValue: string): boolean | null => {
  const range = parseRefRange(refValue);
  if (!range) return null;
  const val = parseFloat(result.replace(',', '.'));
  if (isNaN(val)) return null;
  return val < range.min || val > range.max;
};

/**
 * Key clinical variables that should be shown as trends.
 * Only these variables (matched case-insensitively) generate trend charts.
 * All other variables still appear in the summary table and comparison table.
 */
const TREND_VARIABLES: string[] = [
  'Hematocrito',
  'Hemoglobina',
  'Creatinina',
  'Nitrogeno Ureico',
  'Uremia',
  'Sodio',
  'Potasio',
  'Cloro',
  'HCO3 ACTUAL',
  'CO2 TOTAL',
  'Proteina C Reactiva',
  'VHS',
  'Bilirrubina Total',
  'Bilirrubina Directa',
  'Troponina',
  'LDH',
  'CK Total',
  'Magnesio',
  'Acido Urico',
  'Glicemia',
  'Albumina',
  'Recuento Leucocitos',
  'Recuento de Plaquetas',
  'pH',
  'pCO2',
  'pO2',
  'Lactato',
];

/** Check if a variable name matches any key trend variable (case-insensitive, partial). */
const isTrendVariable = (analysis: string): boolean => {
  const lower = analysis.toLowerCase();
  return TREND_VARIABLES.some(v => lower.includes(v.toLowerCase()));
};

/**
 * Build the processed analytics data from raw exam details and the original exam list.
 */
export const buildAnalysisData = (
  details: SyslabExamDetail[],
  examList: SyslabExamItem[]
): LabAnalysisData => {
  const sections: Record<string, LabSummaryRow[]> = {};
  const trendMap: Record<string, LabTrendPoint[]> = {};
  const comparison: Record<string, Record<string, LabResultRow>> = {};
  const dateSet = new Set<string>();

  // Track seen analysis+date combinations to deduplicate
  // (e.g., Creatinina appears in both BIOQUIMICA and CREA + VFG sections)
  const seenTrend = new Set<string>();
  const seenComparison = new Set<string>();

  for (const detail of details) {
    const exam = examList.find(e => e.link === detail.url);
    const examDate = exam?.date || 'Desconocido';
    const isoDate = parseDateDDMMYYYY(examDate);
    dateSet.add(examDate);

    for (const finding of detail.findings) {
      const sectionKey = finding.section || 'GENERAL';

      // Sections — include date for display, keep all rows
      if (!sections[sectionKey]) sections[sectionKey] = [];
      sections[sectionKey].push({ ...finding, examDate });

      // Comparison grid — deduplicate by analysis+date (keep first occurrence)
      const compKey = `${finding.analysis}::${examDate}`;
      if (!seenComparison.has(compKey)) {
        seenComparison.add(compKey);
        if (!comparison[finding.analysis]) comparison[finding.analysis] = {};
        comparison[finding.analysis][examDate] = finding;
      }

      // Trends — deduplicate by analysis+date, only key clinical variables
      if (isTrendVariable(finding.analysis)) {
        const trendKey = `${finding.analysis}::${examDate}`;
        if (!seenTrend.has(trendKey)) {
          seenTrend.add(trendKey);
          const numValue = parseFloat(finding.result.replace(',', '.'));
          if (!isNaN(numValue)) {
            if (!trendMap[finding.analysis]) trendMap[finding.analysis] = [];
            const range = parseRefRange(finding.refValue);
            trendMap[finding.analysis].push({
              date: examDate,
              isoDate,
              value: numValue,
              unit: finding.unit,
              refMin: range?.min,
              refMax: range?.max,
            });
          }
        }
      }
    }
  }

  // Only keep trends with 2+ unique data points, sorted by date
  const trends: Record<string, LabTrendPoint[]> = {};
  for (const [name, points] of Object.entries(trendMap)) {
    if (points.length >= 2) {
      trends[name] = points.sort((a, b) => a.isoDate.localeCompare(b.isoDate));
    }
  }

  // Sort dates chronologically
  const examDates = Array.from(dateSet).sort((a, b) =>
    parseDateDDMMYYYY(a).localeCompare(parseDateDDMMYYYY(b))
  );

  return { sections, trends, examDates, comparison };
};

/* ------------------------------------------------------------------ */
/*  Hook return type                                                   */
/* ------------------------------------------------------------------ */

export interface UseLabViewerReturn {
  // Search state
  uniquePatients: LabPatient[];
  selectedRut: string;
  isLoading: boolean;
  examList: SyslabExamItem[];
  pdfExam: SyslabExamItem | null;
  error: string | null;
  progress: ProgressState | null;

  // Selection state
  selectedExamIds: Set<string>;

  // Analysis state
  isAnalyzing: boolean;
  analysisData: LabAnalysisData | null;
  analysisView: AnalysisViewTab;

  // Search actions
  selectPatient: (rut: string) => void;
  search: () => Promise<void>;
  openPdf: (exam: SyslabExamItem) => void;
  closePdf: () => void;
  reset: () => void;

  // Selection actions
  toggleExamSelection: (id: string) => void;
  selectAllExams: () => void;
  clearSelection: () => void;

  // Analysis actions
  analyzeSelected: () => Promise<void>;
  closeAnalysis: () => void;
  setAnalysisView: (tab: AnalysisViewTab) => void;
}

/* ------------------------------------------------------------------ */
/*  Hook implementation                                                */
/* ------------------------------------------------------------------ */

export const useLabViewer = (
  patients: LabPatient[],
  initialPatientRut?: string
): UseLabViewerReturn => {
  // Search state
  const [selectedRut, setSelectedRut] = useState(initialPatientRut || patients[0]?.rut || '');
  const [isLoading, setIsLoading] = useState(false);
  const [examList, setExamList] = useState<SyslabExamItem[]>([]);
  const [pdfExam, setPdfExam] = useState<SyslabExamItem | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<ProgressState | null>(null);

  // Selection state
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set());

  // Analysis state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisData, setAnalysisData] = useState<LabAnalysisData | null>(null);
  const [analysisView, setAnalysisView] = useState<AnalysisViewTab>('summary');

  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Deduplicate patients by RUT
  const uniquePatients = useMemo(() => {
    const seen = new Set<string>();
    return patients.filter(p => {
      if (!p.rut || seen.has(p.rut)) return false;
      seen.add(p.rut);
      return true;
    });
  }, [patients]);

  // Animated progress bar
  useEffect(() => {
    const active = isLoading || isAnalyzing;
    if (!active) {
      if (progress) {
        setProgress({ pct: 100, text: '¡Completado!' });
        const timeout = setTimeout(() => setProgress(null), 600);
        return () => clearTimeout(timeout);
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
    setAnalysisView('summary');
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
      if (data.success) {
        setExamList(data.data);
      } else {
        setError(data.error || 'No se pudieron obtener los resultados.');
      }
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

  // --- Selection ---

  const toggleExamSelection = useCallback((id: string) => {
    setSelectedExamIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAllExams = useCallback(() => {
    const allIds = examList.filter(e => e.link).map(e => e.id);
    setSelectedExamIds(prev => {
      const allSelected = allIds.every(id => prev.has(id));
      return allSelected ? new Set() : new Set(allIds);
    });
  }, [examList]);

  const clearSelection = useCallback(() => {
    setSelectedExamIds(new Set());
  }, []);

  // --- Analysis ---

  const analyzeSelected = useCallback(async () => {
    const selectedExams = examList.filter(e => selectedExamIds.has(e.id) && e.link);
    const links = selectedExams.map(e => e.link!);
    if (links.length === 0) return;

    setIsAnalyzing(true);
    setAnalysisData(null);
    setError(null);

    try {
      const data = await fetchSyslabExamDetails(links);
      if (!mountedRef.current) return;

      if (data.success) {
        const processed = buildAnalysisData(data.data, examList);
        setAnalysisData(processed);
        setAnalysisView('summary');
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
  }, [examList, selectedExamIds]);

  const closeAnalysis = useCallback(() => {
    setAnalysisData(null);
    setAnalysisView('summary');
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
    analyzeSelected,
    closeAnalysis,
    setAnalysisView,
  };
};
