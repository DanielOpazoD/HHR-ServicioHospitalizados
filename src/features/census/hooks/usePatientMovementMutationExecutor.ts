import { useCallback, MutableRefObject } from 'react';
import type { DailyRecord } from '@/features/census/contracts/censusRecordContracts';
import type { PersistDailyRecord } from '@/application/shared/dailyRecordCoreContracts';
import { usePatientMovementCurrentRecord } from '@/features/census/hooks/usePatientMovementCurrentRecord';

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
