import { useMemo, useCallback } from 'react';
import type {
  ApplyDailyRecordPatch,
  DailyRecord,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import { createEmptyPatient } from '@/services/factories/patientFactory';
import { BEDS } from '@/constants/beds';
import { useLatestRef } from '@/hooks/useLatestRef';
import type { DischargeTarget } from '@/types/movements';
import {
  resolveAddDischargeMovement,
  buildAddDischargeInput,
  buildDischargeAddCommandPayload,
  resolveDeleteDischargeMovement,
  resolveUpdateDischargeMovement,
  resolveApplyUndoDischargeRecord,
  PatientMovementRuntime,
  patientMovementBrowserRuntime,
  selectDischargeUndoMovement,
  selectMovementUndoAuditMetadata,
} from '@/application/census/public';
import { convertDischargeToCmaRecord } from '@/application/census/movementTypeConversionPolicy';
import { usePatientMovementFeedback } from '@/hooks/usePatientMovementFeedback';
import { usePatientMovementAudit } from '@/hooks/usePatientMovementAudit';
import { usePatientMovementCreationExecutor } from '@/hooks/usePatientMovementCreationExecutor';
import { usePatientMovementUndoExecutor } from '@/hooks/usePatientMovementUndoExecutor';
import { usePatientMovementCurrentRecord } from '@/hooks/usePatientMovementCurrentRecord';
import { usePatientMovementMutationExecutor } from '@/hooks/usePatientMovementMutationExecutor';
import { usePatientMovementMutationByIdExecutor } from '@/hooks/usePatientMovementMutationByIdExecutor';
import type {
  AddDischargeAction,
  ConvertDischargeToCmaAction,
  DeleteDischargeAction,
  DischargeMovementActions,
  UndoDischargeAction,
  UpdateDischargeAction,
} from '@/types/movements';

export const usePatientDischarges = (
  record: DailyRecord | null,
  saveAndUpdate: PersistDailyRecord,
  runtime: PatientMovementRuntime = patientMovementBrowserRuntime,
  patchRecord?: ApplyDailyRecordPatch
): DischargeMovementActions => {
  const recordRef = useLatestRef(record);
  const { notifyCreationError, notifyUndoError } = usePatientMovementFeedback(runtime);
  const { logDischargeEntries, logDischargeUndoEntry } = usePatientMovementAudit();
  const executeMovementCreation = usePatientMovementCreationExecutor({
    saveAndUpdate,
    patchRecord,
    notifyCreationError,
  });
  const executeMovementMutation = usePatientMovementMutationExecutor({
    recordRef,
    saveAndUpdate,
    patchRecord,
    movementKey: 'discharges',
  });
  const withCurrentRecord = usePatientMovementCurrentRecord({ recordRef });
  const executeMovementUndo = usePatientMovementUndoExecutor({
    createEmptyPatient,
    saveAndUpdate,
    patchRecord,
    movementKey: 'discharges',
    notifyUndoError,
  });

  const executeDischargeMutation = usePatientMovementMutationByIdExecutor({
    executeMovementMutation,
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
        void executeMovementCreation({
          kind: 'discharge',
          bedId,
          resolution,
          onSuccess: value => {
            logDischargeEntries(value.auditEntries, currentRecord.date);
          },
        }).catch(() => undefined);
      });
    },
    [executeMovementCreation, logDischargeEntries, withCurrentRecord]
  );

  const updateDischarge: UpdateDischargeAction = useCallback(
    (id, status, dischargeType, dischargeTypeOther, time, movementDate, ieehData) => {
      executeDischargeMutation(
        (record, movementId) =>
          resolveUpdateDischargeMovement({
            record,
            id: movementId,
            status,
            dischargeType,
            dischargeTypeOther,
            time,
            movementDate,
            ieehData,
          }),
        id
      );
    },
    [executeDischargeMutation]
  );

  const deleteDischarge: DeleteDischargeAction = useCallback(
    id => {
      executeDischargeMutation(
        (record, movementId) =>
          resolveDeleteDischargeMovement({
            record,
            id: movementId,
          }),
        id
      );
    },
    [executeDischargeMutation]
  );

  const undoDischarge: UndoDischargeAction = useCallback(
    id => {
      withCurrentRecord(currentRecord => {
        const discharge = selectDischargeUndoMovement(currentRecord, id);
        executeMovementUndo({
          kind: 'discharge',
          movement: discharge,
          record: currentRecord,
          onSuccess: ({ movement, updatedBed }) => {
            const audit = selectMovementUndoAuditMetadata(movement, updatedBed);
            logDischargeUndoEntry(
              {
                dischargeId: movement.id,
                bedId: movement.bedId,
                patientName: audit.patientName,
                rut: audit.rut,
              },
              currentRecord.date
            );
          },
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
    [executeMovementUndo, logDischargeUndoEntry, withCurrentRecord]
  );

  const convertDischargeToCma: ConvertDischargeToCmaAction = useCallback(
    id => {
      withCurrentRecord(currentRecord => {
        const updatedRecord = convertDischargeToCmaRecord(currentRecord, id, () =>
          crypto.randomUUID()
        );
        if (updatedRecord === currentRecord) return;

        if (patchRecord) {
          patchRecord({
            discharges: updatedRecord.discharges,
            cma: updatedRecord.cma,
          });
          return;
        }

        void saveAndUpdate(updatedRecord);
      });
    },
    [patchRecord, saveAndUpdate, withCurrentRecord]
  );

  return useMemo(
    () => ({
      addDischarge,
      updateDischarge,
      deleteDischarge,
      undoDischarge,
      convertDischargeToCma,
    }),
    [addDischarge, updateDischarge, deleteDischarge, undoDischarge, convertDischargeToCma]
  );
};
