import type { BedDefinition, PatientData } from '@/types';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import { derivePatientRowState } from '@/features/census/controllers/patientRowStateController';
import { usePatientRowDependencies } from '@/features/census/components/patient-row/usePatientRowDependencies';
import type { PatientRowRuntime } from '@/features/census/components/patient-row/patientRowRuntimeContracts';
import { usePatientRowEditingRuntime } from '@/features/census/components/patient-row/usePatientRowEditingRuntime';
import { usePatientRowInteractionRuntime } from '@/features/census/components/patient-row/usePatientRowInteractionRuntime';
import { buildPatientRowRuntime } from '@/features/census/controllers/patientRowRuntimeController';
import {
  buildPatientRowEditingRuntimeParams,
  buildPatientRowInteractionRuntimeParams,
} from '@/features/census/controllers/patientRowRuntimeModelController';

interface UsePatientRowRuntimeParams {
  bed: BedDefinition;
  data: PatientData;
  onAction: (action: PatientRowAction, bedId: string, patient: PatientData) => void;
}

export const usePatientRowRuntime = ({
  bed,
  data,
  onAction,
}: UsePatientRowRuntimeParams): PatientRowRuntime => {
  const {
    updatePatient,
    updatePatientMultiple,
    updateClinicalCrib,
    updateClinicalCribMultiple,
    toggleBedType,
    confirm,
    alert,
  } = usePatientRowDependencies();
  const rowState = derivePatientRowState(data);
  const editingRuntime = usePatientRowEditingRuntime({
    ...buildPatientRowEditingRuntimeParams({
      bed,
      data,
      dependencies: {
        updatePatient,
        updatePatientMultiple,
        updateClinicalCrib,
        updateClinicalCribMultiple,
      },
    }),
  });
  const interactionRuntime = usePatientRowInteractionRuntime({
    ...buildPatientRowInteractionRuntimeParams({
      bed,
      data,
      onAction,
      rowState,
      dependencies: {
        updatePatient,
        updateClinicalCrib,
        toggleBedType,
        confirm,
        alert,
      },
    }),
  });

  return buildPatientRowRuntime({
    rowState,
    interactionRuntime,
    editingRuntime,
  });
};
