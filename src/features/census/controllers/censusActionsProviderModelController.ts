import type {
  CensusActionCommandsContextType,
  CensusActionStateContextType,
} from '@/features/census/types/censusActionContextTypes';
import type { CensusActionRuntimeRefs } from '@/features/census/hooks/useCensusActionRuntimeRefs';
import type { CensusActionStateStore } from '@/features/census/hooks/useCensusActionStateStore';

interface BuildCensusActionCommandsControllerParams {
  runtimeRefs: CensusActionRuntimeRefs;
  stateStore: Pick<
    CensusActionStateStore,
    'setActionState' | 'setDischargeState' | 'setTransferState'
  >;
  getCurrentTime: () => string;
}

export const buildCensusActionCommandsControllerParams = ({
  runtimeRefs,
  stateStore,
  getCurrentTime,
}: BuildCensusActionCommandsControllerParams) => ({
  ...runtimeRefs,
  setActionState: stateStore.setActionState,
  setDischargeState: stateStore.setDischargeState,
  setTransferState: stateStore.setTransferState,
  getCurrentTime,
});

interface BuildCensusActionContextValuesParams {
  stateStore: CensusActionStateStore;
  commands: Pick<
    CensusActionCommandsContextType,
    'executeMoveOrCopy' | 'executeDischarge' | 'executeTransfer' | 'handleRowAction'
  >;
}

export const buildCensusActionContextValuesParams = ({
  stateStore,
  commands,
}: BuildCensusActionContextValuesParams): {
  actionState: CensusActionStateContextType['actionState'];
  setActionState: CensusActionStateContextType['setActionState'];
  dischargeState: CensusActionStateContextType['dischargeState'];
  setDischargeState: CensusActionStateContextType['setDischargeState'];
  transferState: CensusActionStateContextType['transferState'];
  setTransferState: CensusActionStateContextType['setTransferState'];
  executeMoveOrCopy: CensusActionCommandsContextType['executeMoveOrCopy'];
  executeDischarge: CensusActionCommandsContextType['executeDischarge'];
  handleEditDischarge: CensusActionCommandsContextType['handleEditDischarge'];
  executeTransfer: CensusActionCommandsContextType['executeTransfer'];
  handleEditTransfer: CensusActionCommandsContextType['handleEditTransfer'];
  handleRowAction: CensusActionCommandsContextType['handleRowAction'];
} => ({
  actionState: stateStore.actionState,
  setActionState: stateStore.setActionState,
  dischargeState: stateStore.dischargeState,
  setDischargeState: stateStore.setDischargeState,
  transferState: stateStore.transferState,
  setTransferState: stateStore.setTransferState,
  executeMoveOrCopy: commands.executeMoveOrCopy,
  executeDischarge: commands.executeDischarge,
  handleEditDischarge: stateStore.handleEditDischarge,
  executeTransfer: commands.executeTransfer,
  handleEditTransfer: stateStore.handleEditTransfer,
  handleRowAction: commands.handleRowAction,
});
