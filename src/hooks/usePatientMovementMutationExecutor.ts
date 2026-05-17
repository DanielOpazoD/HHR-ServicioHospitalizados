import { useCallback, MutableRefObject } from 'react';
import type {
  ApplyDailyRecordPatch,
  DailyRecord,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import {
  buildAtomicPatientMovementPatch,
  type AtomicPatientMovementListKey,
} from '@/application/census/public';
import { usePatientMovementCurrentRecord } from '@/hooks/usePatientMovementCurrentRecord';

interface UsePatientMovementMutationExecutorParams {
  recordRef: MutableRefObject<DailyRecord | null>;
  saveAndUpdate: PersistDailyRecord;
  patchRecord?: ApplyDailyRecordPatch;
  movementKey?: AtomicPatientMovementListKey;
}

export const usePatientMovementMutationExecutor = ({
  recordRef,
  saveAndUpdate,
  patchRecord,
  movementKey,
}: UsePatientMovementMutationExecutorParams) => {
  const withCurrentRecord = usePatientMovementCurrentRecord({ recordRef });

  return useCallback(
    (mutation: (record: DailyRecord) => DailyRecord) => {
      withCurrentRecord(record => {
        const updatedRecord = mutation(record);
        if (patchRecord && movementKey) {
          void patchRecord(
            buildAtomicPatientMovementPatch({
              updatedRecord,
              movementKey,
              sourceBedIds: [],
            })
          );
          return;
        }

        void saveAndUpdate(updatedRecord);
      });
    },
    [movementKey, patchRecord, saveAndUpdate, withCurrentRecord]
  );
};
