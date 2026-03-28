import { useCallback } from 'react';
import type { TransferRequest, TransferFormData, TransferStatus } from '@/types/transfers';
import {
  changeTransferStatusWithResult,
  completeTransferWithResult,
  createTransferRequestWithResult,
  deleteStatusHistoryEntryWithResult,
  deleteTransferRequestWithResult,
  updateTransferRequestWithResult,
} from '@/services/transfers/transferService';
import { getNextStatus } from '@/constants/transferConstants';
import {
  buildCreateTransferPayload,
  resolvePreviousTransferStatus,
} from '@/hooks/controllers/transferManagementController';
import { getLocalDateInputValue } from '@/utils/localDate';
import {
  buildTransferCompletionTimestamp,
  getTransferActionErrorMessage,
  getTransferAuthError,
  getTransferCreationPreconditionError,
  resolveTransferMutationErrorMessage,
  getTransferStatusAdvanceError,
} from '@/hooks/controllers/transferManagementFeedbackController';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import type {
  DailyRecordBedActions,
  DailyRecordMovementActions,
} from '@/hooks/useDailyRecordTypes';
import { logger } from '@/services/utils/loggerService';
import type { TransferMutationResult } from '@/services/transfers/transferService';

const transferManagementLogger = logger.child('useTransferManagementActions');

interface UseTransferManagementActionsParams {
  userEmail: string | null;
  record: DailyRecord | null;
  addTransfer: DailyRecordMovementActions['addTransfer'];
  clearPatient: DailyRecordBedActions['clearPatient'];
  setError: (value: string | null) => void;
}

export const useTransferManagementActions = ({
  userEmail,
  record,
  addTransfer,
  clearPatient,
  setError,
}: UseTransferManagementActionsParams) => {
  const runTransferAction = useCallback(
    async (
      action: Parameters<typeof getTransferActionErrorMessage>[0],
      task: () => Promise<TransferMutationResult<unknown>>
    ) => {
      try {
        const result = await task();
        if (result.status !== 'success') {
          transferManagementLogger.warn(`Transfer action "${action}" returned non-success`, result);
          setError(resolveTransferMutationErrorMessage(action, result));
          return;
        }
        setError(null);
      } catch (err) {
        transferManagementLogger.error(`Transfer action "${action}" failed`, err);
        setError(getTransferActionErrorMessage(action));
      }
    },
    [setError]
  );

  const createTransfer = useCallback(
    async (data: TransferFormData) => {
      const patient = record?.beds?.[data.bedId];
      const preconditionError = getTransferCreationPreconditionError({
        hasUserEmail: Boolean(userEmail),
        hasBeds: Boolean(record?.beds),
        hasPatient: Boolean(patient),
      });
      if (preconditionError || !userEmail || !record || !patient) {
        setError(preconditionError);
        return;
      }

      await runTransferAction('create', async () => {
        return createTransferRequestWithResult(
          buildCreateTransferPayload(
            data,
            patient,
            record.date,
            userEmail,
            data.requestDate || getLocalDateInputValue()
          )
        );
      });
    },
    [record, runTransferAction, setError, userEmail]
  );

  const updateTransfer = useCallback(
    async (id: string, data: Partial<TransferFormData>) => {
      await runTransferAction('update', async () => {
        return updateTransferRequestWithResult(id, data);
      });
    },
    [runTransferAction]
  );

  const advanceStatus = useCallback(
    async (transfer: TransferRequest) => {
      const nextStatus = getNextStatus(transfer.status);
      const preconditionError = getTransferStatusAdvanceError(Boolean(userEmail), nextStatus);
      if (preconditionError || !userEmail || !nextStatus) {
        setError(preconditionError);
        return;
      }

      await runTransferAction('advance', async () => {
        return changeTransferStatusWithResult(transfer.id, nextStatus, userEmail);
      });
    },
    [runTransferAction, setError, userEmail]
  );

  const setTransferStatus = useCallback(
    async (transfer: TransferRequest, status: TransferStatus) => {
      const authError = getTransferAuthError(Boolean(userEmail));
      if (authError || !userEmail) {
        setError(authError);
        return;
      }

      await runTransferAction('set_status', async () => {
        return changeTransferStatusWithResult(transfer.id, status, userEmail);
      });
    },
    [runTransferAction, setError, userEmail]
  );

  const markAsTransferred = useCallback(
    async (transfer: TransferRequest, transferMethod: string) => {
      const authError = getTransferAuthError(Boolean(userEmail));
      if (authError || !userEmail) {
        setError(authError);
        return;
      }

      await runTransferAction('complete', async () => {
        const result = await completeTransferWithResult(transfer.id, userEmail);
        if (result.status !== 'success') {
          return result;
        }
        addTransfer(
          transfer.bedId,
          transferMethod,
          transfer.destinationHospital,
          '',
          undefined,
          buildTransferCompletionTimestamp()
        );
        clearPatient(transfer.bedId);
        return result;
      });
    },
    [addTransfer, clearPatient, runTransferAction, setError, userEmail]
  );

  const cancelTransfer = useCallback(
    async (transfer: TransferRequest, reason: string) => {
      const authError = getTransferAuthError(Boolean(userEmail));
      if (authError || !userEmail) {
        setError(authError);
        return;
      }

      await runTransferAction('cancel', async () => {
        return changeTransferStatusWithResult(transfer.id, 'CANCELLED', userEmail, reason);
      });
    },
    [runTransferAction, setError, userEmail]
  );

  const deleteTransfer = useCallback(
    async (id: string) => {
      await runTransferAction('delete', async () => {
        return deleteTransferRequestWithResult(id);
      });
    },
    [runTransferAction]
  );

  const undoTransfer = useCallback(
    async (transfer: TransferRequest) => {
      const authError = getTransferAuthError(Boolean(userEmail));
      if (authError || !userEmail) {
        setError(authError);
        return;
      }

      await runTransferAction('undo', async () => {
        return changeTransferStatusWithResult(
          transfer.id,
          resolvePreviousTransferStatus(transfer),
          userEmail,
          'Traslado deshecho'
        );
      });
    },
    [runTransferAction, setError, userEmail]
  );

  const archiveTransfer = useCallback(
    async (transfer: TransferRequest) => {
      await runTransferAction('archive', async () => {
        return updateTransferRequestWithResult(transfer.id, {
          archived: true,
          archivedAt: new Date().toISOString(),
        } as Partial<TransferRequest>);
      });
    },
    [runTransferAction]
  );

  const deleteHistoryEntry = useCallback(
    async (transfer: TransferRequest, historyIndex: number) => {
      await runTransferAction('delete_history', async () => {
        return deleteStatusHistoryEntryWithResult(transfer.id, historyIndex);
      });
    },
    [runTransferAction]
  );

  return {
    createTransfer,
    updateTransfer,
    advanceStatus,
    setTransferStatus,
    markAsTransferred,
    cancelTransfer,
    deleteTransfer,
    undoTransfer,
    archiveTransfer,
    deleteHistoryEntry,
  };
};
