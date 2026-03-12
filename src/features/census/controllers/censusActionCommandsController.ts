import type { PatientData } from '@/types';
import type { PatientRowAction } from '@/features/census/types/patientRowActionTypes';
import type { CensusActionNotification } from '@/features/census/controllers/censusActionNotificationController';
import type {
  DischargeExecutionInput,
  TransferExecutionInput,
} from '@/features/census/domain/movements/contracts';

export interface CensusActionCommandsControllerValue {
  executeMoveOrCopy: (targetDate?: string) => void;
  executeDischarge: (data?: DischargeExecutionInput) => void;
  executeTransfer: (data?: TransferExecutionInput) => void;
  handleRowAction: (action: PatientRowAction, bedId: string, patient: PatientData) => void;
}

export const buildCensusActionNotifyErrorAdapter =
  (notifyError: (title: string, message?: string) => void) =>
  ({ title, message }: CensusActionNotification): void => {
    notifyError(title, message);
  };

export const buildCensusActionCommandsControllerValue = ({
  executeMoveOrCopy,
  executeDischarge,
  executeTransfer,
  handleRowAction,
}: CensusActionCommandsControllerValue): CensusActionCommandsControllerValue => ({
  executeMoveOrCopy,
  executeDischarge,
  executeTransfer,
  handleRowAction,
});
