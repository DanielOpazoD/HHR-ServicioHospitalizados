import { useCallback, MutableRefObject } from 'react';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import { usePatientMovementCurrentRecord } from '@/hooks/usePatientMovementCurrentRecord';

interface UsePatientMovementMutationExecutorParams {
  recordRef: MutableRefObject<DailyRecord | null>;
  saveAndUpdate: (updatedRecord: DailyRecord) => void;
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
