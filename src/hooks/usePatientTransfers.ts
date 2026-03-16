import { useMemo, useCallback } from 'react';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { BEDS } from '@/constants/beds';
import { useLatestRef } from '@/hooks/useLatestRef';
import { resolveAddTransferMovement } from '@/hooks/controllers/patientMovementCreationController';
import {
  buildAddTransferInput,
  buildTransferCommandPayload,
} from '@/hooks/controllers/patientMovementCreationInputController';
import {
  resolveDeleteTransferMovement,
  resolveUpdateTransferMovement,
} from '@/hooks/controllers/patientMovementMutationController';
import { resolveApplyUndoTransferRecord } from '@/hooks/controllers/patientMovementUndoMutationController';
import {
  PatientMovementRuntime,
  patientMovementBrowserRuntime,
} from '@/hooks/controllers/patientMovementRuntimeController';
import { selectTransferUndoMovement } from '@/hooks/controllers/patientMovementSelectionController';
import { usePatientMovementFeedback } from '@/hooks/usePatientMovementFeedback';
import { usePatientMovementAudit } from '@/hooks/usePatientMovementAudit';
import { usePatientMovementCreationExecutor } from '@/hooks/usePatientMovementCreationExecutor';
import { usePatientMovementUndoExecutor } from '@/hooks/usePatientMovementUndoExecutor';
import { usePatientMovementCurrentRecord } from '@/hooks/usePatientMovementCurrentRecord';
import { usePatientMovementMutationExecutor } from '@/hooks/usePatientMovementMutationExecutor';
import type {
  AddTransferAction,
  DeleteTransferAction,
  TransferMovementActions,
  UndoTransferAction,
  UpdateTransferAction,
} from '@/types/movements';

export const usePatientTransfers = (
  record: DailyRecord | null,
  saveAndUpdate: (updatedRecord: DailyRecord) => void,
  runtime: PatientMovementRuntime = patientMovementBrowserRuntime
): TransferMovementActions => {
  const recordRef = useLatestRef(record);
  const { notifyCreationError, notifyUndoError } = usePatientMovementFeedback(runtime);
  const { logTransferEntry } = usePatientMovementAudit();
  const executeMovementCreation = usePatientMovementCreationExecutor({
    saveAndUpdate,
    notifyCreationError,
  });
  const executeMovementMutation = usePatientMovementMutationExecutor({
    recordRef,
    saveAndUpdate,
  });
  const withCurrentRecord = usePatientMovementCurrentRecord({ recordRef });
  const executeMovementUndo = usePatientMovementUndoExecutor({
    createEmptyPatient,
    saveAndUpdate,
    notifyUndoError,
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
        executeMovementCreation({
          kind: 'transfer',
          bedId,
          resolution,
          onSuccess: value => {
            logTransferEntry(value.auditEntry, currentRecord.date);
          },
        });
      });
    },
    [executeMovementCreation, logTransferEntry, withCurrentRecord]
  );

  const updateTransfer: UpdateTransferAction = useCallback(
    (id, updates) => {
      executeMovementMutation(record =>
        resolveUpdateTransferMovement({
          record,
          id,
          updates,
        })
      );
    },
    [executeMovementMutation]
  );

  const deleteTransfer: DeleteTransferAction = useCallback(
    id => {
      executeMovementMutation(record =>
        resolveDeleteTransferMovement({
          record,
          id,
        })
      );
    },
    [executeMovementMutation]
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
