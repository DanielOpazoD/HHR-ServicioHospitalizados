import type { Dispatch, SetStateAction } from 'react';

import { applyTransferPatch } from '@/features/census/controllers/censusModalStateController';
import { buildTransferRuntimeActions } from '@/features/census/controllers/censusActionRuntimeAdapterController';
import { executeTransferController } from '@/features/census/controllers/censusActionRuntimeController';
import {
  buildTransferErrorNotification,
  type CensusActionNotification,
} from '@/features/census/controllers/censusActionNotificationController';
import type { CensusActionRuntimeRefs } from '@/features/census/hooks/useCensusActionRuntimeRefs';
import { useCensusModalCommand } from '@/features/census/hooks/useCensusModalCommand';
import type { TransferExecutionInput } from '@/features/census/domain/movements/contracts';
import type { TransferState } from '@/features/census/types/censusActionTypes';
import { useAuth } from '@/context/AuthContext';
import {
  completeTransferWithResult,
  createFinalizedTransferRequestWithResult,
  getLatestOpenTransferRequestByBedId,
} from '@/services/transfers/transferService';
import {
  resolveTransferDestinationHospital,
  syncCensusTransferRequest,
} from '@/features/census/controllers/censusTransferSyncController';
import { createScopedLogger } from '@/services/utils/loggerScope';

const censusTransferCommandLogger = createScopedLogger('CensusTransferCommand');

interface UseCensusTransferCommandParams extends Pick<
  CensusActionRuntimeRefs,
  'transferStateRef' | 'stabilityRulesRef' | 'addTransferRef' | 'updateTransferRef' | 'recordRef'
> {
  setTransferState: Dispatch<SetStateAction<TransferState>>;
  getCurrentTime: () => string;
  notifyError: (notification: CensusActionNotification) => void;
}

export const useCensusTransferCommand = ({
  transferStateRef,
  stabilityRulesRef,
  addTransferRef,
  updateTransferRef,
  recordRef,
  setTransferState,
  getCurrentTime,
  notifyError,
}: UseCensusTransferCommandParams) => {
  const { currentUser } = useAuth();
  const createdByEmail = currentUser?.email ?? 'census-auto@local';

  return useCensusModalCommand<TransferExecutionInput>(async data => {
    const transferState = transferStateRef.current;
    const record = recordRef.current;
    const bedId = transferState.bedId;
    const patient = bedId ? record?.beds?.[bedId] : undefined;
    const destinationHospital = resolveTransferDestinationHospital(
      transferState.receivingCenter,
      transferState.receivingCenterOther
    );

    const result = executeTransferController({
      transferState,
      data,
      stabilityRules: stabilityRulesRef.current,
      nowTime: getCurrentTime(),
      actions: buildTransferRuntimeActions(addTransferRef.current, updateTransferRef.current),
    });

    if (!result.ok) {
      notifyError(buildTransferErrorNotification(result.error.code, result.error.message));
      return;
    }

    setTransferState(prev => applyTransferPatch(prev, result.value.closeModalPatch));

    if (!transferState.recordId && bedId && patient && destinationHospital) {
      try {
        await syncCensusTransferRequest({
          bedId,
          patient,
          recordDate: record?.date,
          data,
          destinationHospital,
          createdByEmail,
          getLatestOpenTransferRequestByBedId,
          createFinalizedTransferRequestWithResult,
          completeTransferWithResult,
        });
      } catch (syncError) {
        censusTransferCommandLogger.error(
          'Failed to sync census transfer with transfer management',
          syncError
        );
        notifyError({
          title: 'Traslado registrado con advertencia',
          message:
            'Se registró el traslado en Censo, pero no se pudo sincronizar automáticamente con Gestión de Traslados.',
        });
      }
    }
  });
};
