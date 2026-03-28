import { useMemo, useCallback } from 'react';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { BEDS } from '@/constants/beds';
import { useLatestRef } from '@/hooks/useLatestRef';
import type { DischargeTarget } from '@/types/movements';
import { resolveAddDischargeMovement } from '@/hooks/controllers/patientMovementCreationController';
import {
  buildAddDischargeInput,
  buildDischargeAddCommandPayload,
} from '@/hooks/controllers/patientMovementCreationInputController';
import {
  resolveDeleteDischargeMovement,
  resolveUpdateDischargeMovement,
} from '@/hooks/controllers/patientMovementMutationController';
import { resolveApplyUndoDischargeRecord } from '@/hooks/controllers/patientMovementUndoMutationController';
import {
  PatientMovementRuntime,
  patientMovementBrowserRuntime,
} from '@/hooks/controllers/patientMovementRuntimeController';
import { selectDischargeUndoMovement } from '@/hooks/controllers/patientMovementSelectionController';
import { usePatientMovementFeedback } from '@/hooks/usePatientMovementFeedback';
import { usePatientMovementAudit } from '@/hooks/usePatientMovementAudit';
import { usePatientMovementCreationExecutor } from '@/hooks/usePatientMovementCreationExecutor';
import { usePatientMovementUndoExecutor } from '@/hooks/usePatientMovementUndoExecutor';
import { usePatientMovementCurrentRecord } from '@/hooks/usePatientMovementCurrentRecord';
import { usePatientMovementMutationExecutor } from '@/hooks/usePatientMovementMutationExecutor';
import type {
  AddDischargeAction,
  DeleteDischargeAction,
  DischargeMovementActions,
  UndoDischargeAction,
  UpdateDischargeAction,
} from '@/types/movements';

export const usePatientDischarges = (
  record: DailyRecord | null,
  saveAndUpdate: (updatedRecord: DailyRecord) => void,
  runtime: PatientMovementRuntime = patientMovementBrowserRuntime
): DischargeMovementActions => {
  const recordRef = useLatestRef(record);
  const { notifyCreationError, notifyUndoError } = usePatientMovementFeedback(runtime);
  const { logDischargeEntries } = usePatientMovementAudit();
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

  const addDischarge: AddDischargeAction = useCallback(
    (
      bedId,
      status,
      cribStatus,
      dischargeType,
      dischargeTypeOther,
      time,
      target: DischargeTarget = 'both',
      movementDate
    ) => {
      withCurrentRecord(currentRecord => {
        const payload = buildDischargeAddCommandPayload({
          status,
          cribStatus,
          dischargeType,
          dischargeTypeOther,
          time,
          movementDate,
          target,
        });
        const resolution = resolveAddDischargeMovement(
          buildAddDischargeInput({
            record: currentRecord,
            bedId,
            payload,
            bedsCatalog: BEDS,
            createEmptyPatient,
          })
        );
        executeMovementCreation({
          kind: 'discharge',
          bedId,
          resolution,
          onSuccess: value => {
            logDischargeEntries(value.auditEntries, currentRecord.date);
          },
        });
      });
    },
    [executeMovementCreation, logDischargeEntries, withCurrentRecord]
  );

  const updateDischarge: UpdateDischargeAction = useCallback(
    (id, status, dischargeType, dischargeTypeOther, time, movementDate, ieehData) => {
      executeMovementMutation(record =>
        resolveUpdateDischargeMovement({
          record,
          id,
          status,
          dischargeType,
          dischargeTypeOther,
          time,
          movementDate,
          ieehData,
        })
      );
    },
    [executeMovementMutation]
  );

  const deleteDischarge: DeleteDischargeAction = useCallback(
    id => {
      executeMovementMutation(record =>
        resolveDeleteDischargeMovement({
          record,
          id,
        })
      );
    },
    [executeMovementMutation]
  );

  const undoDischarge: UndoDischargeAction = useCallback(
    id => {
      withCurrentRecord(currentRecord => {
        const discharge = selectDischargeUndoMovement(currentRecord, id);
        executeMovementUndo({
          kind: 'discharge',
          movement: discharge,
          record: currentRecord,
          applyUndoRecord: ({ record, movementId, bedId, updatedBed }) =>
            resolveApplyUndoDischargeRecord({
              record,
              dischargeId: movementId,
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
      addDischarge,
      updateDischarge,
      deleteDischarge,
      undoDischarge,
    }),
    [addDischarge, updateDischarge, deleteDischarge, undoDischarge]
  );
};
