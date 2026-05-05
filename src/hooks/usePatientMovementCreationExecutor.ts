import { useCallback } from 'react';
import type { DailyRecord } from '@/application/shared/dailyRecordCoreContracts';
import type {
  ApplyDailyRecordPatch,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import type {
  MovementCreationError,
  MovementCreationErrorCode,
  MovementKind,
} from '@/application/census/public';
import type { ControllerResult } from '@/shared/contracts/controllerResult';
import {
  buildAtomicPatientMovementPatch,
  resolveAtomicPatientMovementListKey,
} from '@/application/census/public';

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
