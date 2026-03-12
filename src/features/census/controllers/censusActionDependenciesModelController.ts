import type { BuildCensusActionDependenciesParams } from '@/features/census/controllers/censusActionDependenciesController';
import type { CensusActionDependenciesData } from '@/features/census/controllers/censusActionDependenciesController';
import type { CensusActionDependenciesRuntime } from '@/features/census/controllers/censusActionDependenciesController';
import type { CensusActionDependenciesUi } from '@/features/census/controllers/censusActionDependenciesController';

interface BuildCensusActionDependenciesModelParams {
  dailyRecordData: CensusActionDependenciesData;
  bedActions: Pick<
    CensusActionDependenciesRuntime,
    'clearPatient' | 'moveOrCopyPatient' | 'copyPatientToDate'
  >;
  movementActions: Pick<
    CensusActionDependenciesRuntime,
    'addDischarge' | 'updateDischarge' | 'addTransfer' | 'updateTransfer' | 'addCMA'
  >;
  confirmDialog: Pick<CensusActionDependenciesUi, 'confirm'>;
  notification: {
    error: CensusActionDependenciesUi['notifyError'];
  };
}

export const buildCensusActionDependenciesModelParams = ({
  dailyRecordData,
  bedActions,
  movementActions,
  confirmDialog,
  notification,
}: BuildCensusActionDependenciesModelParams): BuildCensusActionDependenciesParams => ({
  data: {
    record: dailyRecordData.record,
    stabilityRules: dailyRecordData.stabilityRules,
  },
  runtime: {
    clearPatient: bedActions.clearPatient,
    moveOrCopyPatient: bedActions.moveOrCopyPatient,
    addDischarge: movementActions.addDischarge,
    updateDischarge: movementActions.updateDischarge,
    addTransfer: movementActions.addTransfer,
    updateTransfer: movementActions.updateTransfer,
    addCMA: movementActions.addCMA,
    copyPatientToDate: bedActions.copyPatientToDate,
  },
  ui: {
    confirm: confirmDialog.confirm,
    notifyError: notification.error,
  },
});
