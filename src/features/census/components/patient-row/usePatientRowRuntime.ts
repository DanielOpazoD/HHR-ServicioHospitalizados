import type { BedDefinition, PatientData } from '@/types';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import { derivePatientRowState } from '@/features/census/controllers/patientRowStateController';
import { usePatientRowDependencies } from '@/features/census/components/patient-row/usePatientRowDependencies';
import type { PatientRowRuntime } from '@/features/census/components/patient-row/patientRowRuntimeContracts';
import { usePatientRowEditingRuntime } from '@/features/census/components/patient-row/usePatientRowEditingRuntime';
import { usePatientRowInteractionRuntime } from '@/features/census/components/patient-row/usePatientRowInteractionRuntime';

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
    bedId: bed.id,
    documentType: data?.documentType,
    updatePatient,
    updatePatientMultiple,
    updateClinicalCrib,
    updateClinicalCribMultiple,
  });
  const interactionRuntime = usePatientRowInteractionRuntime({
    bedId: bed.id,
    data,
    onAction,
    rowState,
    updatePatient,
    updateClinicalCrib,
    toggleBedType,
    confirm,
    alert,
  });

  return {
    rowState,
    ...interactionRuntime,
    ...editingRuntime,
  };
};
