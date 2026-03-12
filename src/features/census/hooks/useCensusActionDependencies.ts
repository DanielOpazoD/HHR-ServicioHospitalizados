import { useMemo } from 'react';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import {
  useDailyRecordBedActions,
  useDailyRecordMovementActions,
} from '@/context/useDailyRecordScopedActions';
import { useConfirmDialog, useNotification } from '@/context/UIContext';
import {
  buildCensusActionDependencies,
  type CensusActionDependenciesData,
  type CensusActionDependenciesRuntime,
  type CensusActionDependenciesUi,
} from '@/features/census/controllers/censusActionDependenciesController';
import { buildCensusActionDependenciesModelParams } from '@/features/census/controllers/censusActionDependenciesModelController';

export type CensusActionDependencies = CensusActionDependenciesData &
  CensusActionDependenciesRuntime &
  CensusActionDependenciesUi;

export const useCensusActionDependencies = (): CensusActionDependencies => {
  const { record, stabilityRules } = useDailyRecordData();
  const { clearPatient, moveOrCopyPatient, copyPatientToDate } = useDailyRecordBedActions();
  const { addDischarge, updateDischarge, addTransfer, updateTransfer, addCMA } =
    useDailyRecordMovementActions();
  const { confirm } = useConfirmDialog();
  const { error: notifyError } = useNotification();

  return useMemo(
    () =>
      buildCensusActionDependencies(
        buildCensusActionDependenciesModelParams({
          dailyRecordData: {
            record,
            stabilityRules,
          },
          bedActions: {
            clearPatient,
            moveOrCopyPatient,
            copyPatientToDate,
          },
          movementActions: {
            addDischarge,
            updateDischarge,
            addTransfer,
            updateTransfer,
            addCMA,
          },
          confirmDialog: {
            confirm,
          },
          notification: {
            error: notifyError,
          },
        })
      ),
    [
      addCMA,
      addDischarge,
      addTransfer,
      clearPatient,
      confirm,
      copyPatientToDate,
      moveOrCopyPatient,
      notifyError,
      record,
      stabilityRules,
      updateDischarge,
      updateTransfer,
    ]
  );
};
