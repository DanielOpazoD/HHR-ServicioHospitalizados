import { useMemo } from 'react';
import type { PatientData } from '@/types';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import { usePatientRowRuntime } from './usePatientRowRuntime';
import {
  buildPatientRowBindings,
  type PatientRowBindingsInput,
} from '@/features/census/controllers/patientRowBindingsController';

interface UsePatientRowBindingsModelParams extends PatientRowBindingsInput {
  onAction: (action: PatientRowAction, bedId: string, patient: PatientData) => void;
}

export const usePatientRowBindingsModel = ({
  bed,
  data,
  currentDateString,
  onAction,
  readOnly,
  actionMenuAlign,
  diagnosisMode,
  isSubRow,
  role,
  accessProfile,
  indicators,
  bedType,
  style,
}: UsePatientRowBindingsModelParams) => {
  const runtime = usePatientRowRuntime({ bed, data, onAction });

  return useMemo(
    () =>
      buildPatientRowBindings({
        bed,
        bedType,
        data,
        currentDateString,
        readOnly,
        actionMenuAlign,
        diagnosisMode,
        isSubRow,
        role,
        accessProfile,
        indicators,
        style,
        runtime,
      }),
    [
      actionMenuAlign,
      bed,
      bedType,
      currentDateString,
      data,
      diagnosisMode,
      indicators,
      isSubRow,
      role,
      accessProfile,
      readOnly,
      runtime,
      style,
    ]
  );
};
