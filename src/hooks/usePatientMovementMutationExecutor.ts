import { useCallback, MutableRefObject } from 'react';
import type {
  DailyRecord,
  PersistDailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import { usePatientMovementCurrentRecord } from '@/hooks/usePatientMovementCurrentRecord';

interface UsePatientMovementMutationExecutorParams {
  recordRef: MutableRefObject<DailyRecord | null>;
  saveAndUpdate: PersistDailyRecord;
}

export const usePatientMovementMutationExecutor = ({
  recordRef,
  saveAndUpdate,
}: UsePatientMovementMutationExecutorParams) => {
  const withCurrentRecord = usePatientMovementCurrentRecord({ recordRef });

  return useCallback(
    (mutation: (record: DailyRecord) => DailyRecord) => {
      withCurrentRecord(record => {
        saveAndUpdate(mutation(record));
      });
    },
    [saveAndUpdate, withCurrentRecord]
  );
};
