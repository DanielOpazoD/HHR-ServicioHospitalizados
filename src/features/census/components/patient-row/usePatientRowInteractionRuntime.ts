import { useCallback, useMemo } from 'react';

import { usePatientRowUiState } from '@/features/census/components/patient-row/usePatientRowUiState';
import { usePatientRowBedConfigActions } from '@/features/census/components/patient-row/usePatientRowBedConfigActions';
import {
  buildPatientRowActionDispatcher,
  buildPatientRowBedTypeToggles,
} from '@/features/census/controllers/patientRowRuntimeController';
import type { ControllerConfirmDescriptor } from '@/features/census/controllers/controllerConfirmDescriptor';
import type { PatientData } from '@/types';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';

interface UsePatientRowInteractionRuntimeParams {
  bedId: string;
  data: PatientData;
  onAction: (action: PatientRowAction, bedId: string, patient: PatientData) => void;
  rowState: {
    isCunaMode: boolean;
    hasCompanion: boolean;
    hasClinicalCrib: boolean;
  };
  updatePatient: (
    bedId: string,
    field: 'bedMode' | 'hasCompanionCrib',
    value: 'Cama' | 'Cuna' | boolean
  ) => void;
  updateClinicalCrib: (bedId: string, field: 'create' | 'remove') => void;
  toggleBedType: (bedId: string) => void;
  confirm: (options: ControllerConfirmDescriptor) => Promise<boolean>;
  alert: (message: string, title?: string) => Promise<void>;
}

export const usePatientRowInteractionRuntime = ({
  bedId,
  data,
  onAction,
  rowState,
  updatePatient,
  updateClinicalCrib,
  toggleBedType,
  confirm,
  alert,
}: UsePatientRowInteractionRuntimeParams) => {
  const uiState = usePatientRowUiState();

  const bedConfigActions = usePatientRowBedConfigActions({
    bedId,
    isCunaMode: rowState.isCunaMode,
    hasCompanion: rowState.hasCompanion,
    hasClinicalCrib: rowState.hasClinicalCrib,
    updatePatient,
    updateClinicalCrib,
    confirm,
    alert,
  });

  const handleAction = useCallback(
    (action: PatientRowAction) =>
      buildPatientRowActionDispatcher({ onAction, bedId, patient: data })(action),
    [onAction, bedId, data]
  );

  const bedTypeToggles = useMemo(
    () =>
      buildPatientRowBedTypeToggles({
        bedId,
        toggleBedType,
        updateClinicalCrib,
      }),
    [bedId, toggleBedType, updateClinicalCrib]
  );

  return {
    uiState,
    bedConfigActions,
    handleAction,
    bedTypeToggles,
  };
};
