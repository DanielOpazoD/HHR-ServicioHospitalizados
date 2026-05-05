import { useCallback } from 'react';
import type { DailyRecord } from '@/features/census/contracts/censusRecordContracts';
import type {
  ApplyDailyRecordPatch,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import {
  MovementCreationError,
  MovementCreationErrorCode,
} from '@/features/census/controllers/patientMovementCreationController';
import { MovementKind } from '@/features/census/controllers/patientMovementCreationErrorPresentation';
import { ControllerResult } from '@/features/census/controllers/controllerResult';
import {
  buildAtomicPatientMovementPatch,
  resolveAtomicPatientMovementListKey,
} from '@/features/census/controllers/atomicPatientMovementPatchController';

type MovementCreationResolution<TValue extends { updatedRecord: DailyRecord }> = ControllerResult<
  TValue,
  MovementCreationErrorCode,
  MovementCreationError
>;

interface ExecuteMovementCreationParams<TValue extends { updatedRecord: DailyRecord }> {
  kind: MovementKind;
  bedId: string;
  resolution: MovementCreationResolution<TValue>;
  onSuccess?: (value: TValue) => void;
}

interface UsePatientMovementCreationExecutorParams {
  saveAndUpdate: PersistDailyRecord;
  patchRecord?: ApplyDailyRecordPatch;
  notifyCreationError: (kind: MovementKind, code: MovementCreationErrorCode, bedId: string) => void;
}

export const usePatientMovementCreationExecutor = ({
  saveAndUpdate,
  patchRecord,
  notifyCreationError,
}: UsePatientMovementCreationExecutorParams) => {
  return useCallback(
    <TValue extends { updatedRecord: DailyRecord }>({
      kind,
      bedId,
      resolution,
      onSuccess,
    }: ExecuteMovementCreationParams<TValue>) => {
      if (!resolution.ok) {
        notifyCreationError(kind, resolution.error.code, bedId);
        return;
      }

      if (patchRecord) {
        patchRecord(
          buildAtomicPatientMovementPatch({
            updatedRecord: resolution.value.updatedRecord,
            movementKey: resolveAtomicPatientMovementListKey(kind),
            sourceBedIds: [bedId],
          })
        );
      } else {
        saveAndUpdate(resolution.value.updatedRecord);
      }
      onSuccess?.(resolution.value);
    },
    [notifyCreationError, patchRecord, saveAndUpdate]
  );
};
