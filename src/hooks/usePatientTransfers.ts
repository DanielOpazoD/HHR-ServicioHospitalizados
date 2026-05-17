import { useMemo, useCallback } from 'react';
import type {
  ApplyDailyRecordPatch,
  DailyRecord,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { BEDS } from '@/constants/beds';
import { useLatestRef } from '@/hooks/useLatestRef';
import {
  resolveAddTransferMovement,
  buildAddTransferInput,
  buildTransferCommandPayload,
  resolveDeleteTransferMovement,
  resolveUpdateTransferMovement,
  resolveApplyUndoTransferRecord,
  PatientMovementRuntime,
  patientMovementBrowserRuntime,
  selectTransferUndoMovement,
} from '@/application/census/public';
import { usePatientMovementFeedback } from '@/hooks/usePatientMovementFeedback';
import { usePatientMovementAudit } from '@/hooks/usePatientMovementAudit';
import { usePatientMovementCreationExecutor } from '@/hooks/usePatientMovementCreationExecutor';
import { usePatientMovementUndoExecutor } from '@/hooks/usePatientMovementUndoExecutor';
import { usePatientMovementCurrentRecord } from '@/hooks/usePatientMovementCurrentRecord';
import { usePatientMovementMutationExecutor } from '@/hooks/usePatientMovementMutationExecutor';
import { usePatientMovementMutationByIdExecutor } from '@/hooks/usePatientMovementMutationByIdExecutor';
import type {
  AddTransferAction,
  DeleteTransferAction,
  TransferMovementActions,
  UndoTransferAction,
  UpdateTransferAction,
} from '@/types/movements';

export const usePatientTransfers = (
  record: DailyRecord | null,
  saveAndUpdate: PersistDailyRecord,
  runtime: PatientMovementRuntime = patientMovementBrowserRuntime,
  patchRecord?: ApplyDailyRecordPatch
): TransferMovementActions => {
  const recordRef = useLatestRef(record);
  const { notifyCreationError, notifyUndoError } = usePatientMovementFeedback(runtime);
  const { logTransferEntry } = usePatientMovementAudit();
  const executeMovementCreation = usePatientMovementCreationExecutor({
    saveAndUpdate,
    patchRecord,
    notifyCreationError,
  });
  const executeMovementMutation = usePatientMovementMutationExecutor({
    recordRef,
    saveAndUpdate,
    patchRecord,
    movementKey: 'transfers',
  });
  const withCurrentRecord = usePatientMovementCurrentRecord({ recordRef });
  const executeMovementUndo = usePatientMovementUndoExecutor({
    createEmptyPatient,
    saveAndUpdate,
    patchRecord,
    movementKey: 'transfers',
    notifyUndoError,
  });

  const executeTransferMutation = usePatientMovementMutationByIdExecutor({
    executeMovementMutation,
  });

  const addTransfer: AddTransferAction = useCallback(
    (bedId, method, center, centerOther, escort, time, movementDate) => {
      withCurrentRecord(currentRecord => {
        const payload = buildTransferCommandPayload({
          method,
          center,
          centerOther,
          escort,
          time,
          movementDate,
        });
        const resolution = resolveAddTransferMovement(
          buildAddTransferInput({
            record: currentRecord,
            bedId,
            payload,
            bedsCatalog: BEDS,
            createEmptyPatient,
          })
        );
        void executeMovementCreation({
          kind: 'transfer',
          bedId,
          resolution,
          onSuccess: value => {
            logTransferEntry(value.auditEntry, currentRecord.date);
          },
        }).catch(() => undefined);
      });
    },
    [executeMovementCreation, logTransferEntry, withCurrentRecord]
  );

  const updateTransfer: UpdateTransferAction = useCallback(
    (id, updates) => {
      executeTransferMutation(
        (record, movementId) =>
          resolveUpdateTransferMovement({
            record,
            id: movementId,
            updates,
          }),
        id
      );
    },
    [executeTransferMutation]
  );

  const deleteTransfer: DeleteTransferAction = useCallback(
    id => {
      executeTransferMutation(
        (record, movementId) =>
          resolveDeleteTransferMovement({
            record,
            id: movementId,
          }),
        id
      );
    },
    [executeTransferMutation]
  );

  const undoTransfer: UndoTransferAction = useCallback(
    id => {
      withCurrentRecord(currentRecord => {
        const transfer = selectTransferUndoMovement(currentRecord, id);
        executeMovementUndo({
          kind: 'transfer',
          movement: transfer,
          record: currentRecord,
          applyUndoRecord: ({ record, movementId, bedId, updatedBed }) =>
            resolveApplyUndoTransferRecord({
              record,
              transferId: movementId,
              bedId,
              updatedBed,
            }),
        });
      });
    },
    [executeMovementUndo, withCurrentRecord]
  );

  return useMemo(
    () => ({
      addTransfer,
      updateTransfer,
      deleteTransfer,
      undoTransfer,
    }),
    [addTransfer, updateTransfer, deleteTransfer, undoTransfer]
  );
};
