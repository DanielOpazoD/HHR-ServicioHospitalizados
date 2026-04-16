/**
 * useExamRequest Hook
 * Manages state and logic for the laboratory exam request form.
 */

import { useState, useCallback, useEffect } from 'react';
import { PatientData } from '@/hooks/contracts/patientHookContracts';
import { runExamRequestPrint } from '@/hooks/controllers/examRequestPrintController';
import {
  buildExamRequestOpenState,
  countSelectedExamRequests,
  toggleExamRequestSelection,
} from '@/hooks/controllers/examRequestController';

interface UseExamRequestParams {
  patient: PatientData;
  isOpen?: boolean;
}

interface UseExamRequestReturn {
  // State
  selectedExams: Set<string>;
  procedencia: string;
  prevision: string;

  // Setters
  setProcedencia: (value: string) => void;
  setPrevision: (value: string) => void;

  // Actions
  toggleExam: (examKey: string) => void;
  handlePrint: () => void;
  getSelectedCount: () => number;
}

export const useExamRequest = ({ patient, isOpen }: UseExamRequestParams): UseExamRequestReturn => {
  const [selectedExams, setSelectedExams] = useState<Set<string>>(() => new Set());
  const [procedencia, setProcedencia] = useState(() => buildExamRequestOpenState().procedencia);
  const [prevision, setPrevision] = useState(
    () => buildExamRequestOpenState(patient.insurance).prevision
  );

  // Reset when modal opens - use timeout to avoid cascading render warning
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        const nextState = buildExamRequestOpenState(patient.insurance);
        setSelectedExams(nextState.selectedExams);
        setProcedencia(nextState.procedencia);
        setPrevision(nextState.prevision);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [isOpen, patient.insurance]);

  const toggleExam = useCallback((examKey: string) => {
    setSelectedExams(prev => toggleExamRequestSelection(prev, examKey));
  }, []);

  const handlePrint = useCallback(() => {
    runExamRequestPrint();
  }, []);

  const getSelectedCount = useCallback(
    () => countSelectedExamRequests(selectedExams),
    [selectedExams]
  );

  return {
    selectedExams,
    procedencia,
    prevision,
    setProcedencia,
    setPrevision,
    toggleExam,
    handlePrint,
    getSelectedCount,
  };
};
