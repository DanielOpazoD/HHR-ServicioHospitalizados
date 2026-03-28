import type { BedDefinition } from '@/types/domain/beds';
import type { PatientData } from '@/features/census/components/patient-row/patientRowDataContracts';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import { derivePatientRowState } from '../../controllers/patientRowStateController';
import { usePatientRowDependencies } from './usePatientRowDependencies';
import type { PatientRowRuntime } from './patientRowRuntimeContracts';
import { usePatientRowEditingRuntime } from './usePatientRowEditingRuntime';
import { usePatientRowInteractionRuntime } from './usePatientRowInteractionRuntime';
import { buildPatientRowRuntime } from '../../controllers/patientRowRuntimeController';
import {
  buildPatientRowEditingRuntimeParams,
  buildPatientRowInteractionRuntimeParams,
} from '../../controllers/patientRowRuntimeModelController';

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
