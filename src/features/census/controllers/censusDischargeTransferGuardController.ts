import { buildDischargeWithActiveTransferConfirmDialog } from '@/features/census/controllers/censusMovementActionConfirmController';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DischargeState } from '@/features/census/types/censusActionTypes';
import type { getLatestOpenTransferRequestByBedId } from '@/services/transfers/transferService';

interface RunDischargeWithTransferGuardParams {
  dischargeState: DischargeState;
  record: DailyRecord | null;
  executeDischarge: () => Promise<void>;
  runConfirmedMovementAction: (params: {
    dialog: ReturnType<typeof buildDischargeWithActiveTransferConfirmDialog>;
    run: () => Promise<void>;
    errorTitle: string;
  }) => Promise<void>;
  getLatestOpenTransferRequestByBedId: typeof getLatestOpenTransferRequestByBedId;
  warn: (message: string, error: unknown) => void;
}

export const runDischargeWithTransferGuard = async ({
  dischargeState,
  record,
  executeDischarge,
  runConfirmedMovementAction,
  getLatestOpenTransferRequestByBedId,
  warn,
}: RunDischargeWithTransferGuardParams): Promise<void> => {
  const bedId = dischargeState.bedId;

  if (!bedId || dischargeState.recordId) {
    await executeDischarge();
    return;
  }

  try {
    const activeTransfer = await getLatestOpenTransferRequestByBedId(bedId);
    if (!activeTransfer) {
      await executeDischarge();
      return;
    }

    const patientName = record?.beds?.[bedId]?.patientName;

    await runConfirmedMovementAction({
      dialog: buildDischargeWithActiveTransferConfirmDialog(patientName),
      run: executeDischarge,
      errorTitle: 'No se pudo confirmar el alta',
    });
  } catch (error) {
    warn(`[Census Discharge] Failed to validate active transfer context for bed ${bedId}:`, error);
    await executeDischarge();
  }
};
