/**
 * @module useLabViewer
 * @description React hook that encapsulates all state and logic for the
 * laboratory exam viewer modal. Separates business logic from presentation.
 *
 * Manages:
 * - Patient selection (deduplication by RUT)
 * - Exam list search via Syslab API
 * - PDF viewer state (which exam is being viewed)
 * - Progress bar animation
 * - Error handling
 */

import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { searchSyslabExams } from '@/services/laboratory/syslabService';
import type { SyslabExamItem, LabPatient } from '@/types/domain/laboratory';

/* ------------------------------------------------------------------ */
/*  Progress bar                                                       */
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

const STEP_INTERVAL_MS = 2500;

/* ------------------------------------------------------------------ */
/*  Hook return type                                                   */
/* ------------------------------------------------------------------ */

export interface UseLabViewerReturn {
  /** Deduplicated patient list. */
  uniquePatients: LabPatient[];
  /** Currently selected patient RUT. */
  selectedRut: string;
  /** Whether the exam list is loading. */
  isLoading: boolean;
  /** List of exams returned by the last search. */
  examList: SyslabExamItem[];
  /** The exam currently being viewed as PDF, or `null`. */
  pdfExam: SyslabExamItem | null;
  /** Error message from the last operation, or `null`. */
  error: string | null;
  /** Current progress bar state, or `null` when idle. */
  progress: ProgressState | null;

  /** Change the selected patient and reset state. */
  selectPatient: (rut: string) => void;
  /** Trigger an exam list search for the selected patient. */
  search: () => Promise<void>;
  /** Open the PDF viewer for a specific exam. */
  openPdf: (exam: SyslabExamItem) => void;
  /** Close the PDF viewer and return to the exam list. */
  closePdf: () => void;
  /** Reset all state (used when modal closes/reopens). */
  reset: () => void;
}

/* ------------------------------------------------------------------ */
/*  Hook implementation                                                */
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

  // Track mount state to avoid state updates after unmount
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
    if (!isLoading) {
      if (progress) {
        setProgress({ pct: 100, text: '¡Completado!' });
        const timeout = setTimeout(() => setProgress(null), 600);
        return () => clearTimeout(timeout);
      }
      return;
    }

    let step = 0;
    setProgress(SEARCH_STEPS[0]);
    step = 1;

    const interval = setInterval(() => {
      if (step < SEARCH_STEPS.length) {
        setProgress(SEARCH_STEPS[step]);
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
  }, [isLoading]); // eslint-disable-line react-hooks/exhaustive-deps

  const resetState = useCallback(() => {
    setExamList([]);
    setPdfExam(null);
    setError(null);
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

  return {
    uniquePatients,
    selectedRut,
    isLoading,
    examList,
    pdfExam,
    error,
    progress,
    selectPatient,
    search,
    openPdf,
    closePdf,
    reset,
  };
};
