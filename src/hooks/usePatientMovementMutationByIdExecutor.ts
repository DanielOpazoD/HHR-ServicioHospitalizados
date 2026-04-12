import { useCallback } from 'react';
import type { DailyRecord } from '@/application/shared/dailyRecordCoreContracts';

interface UsePatientMovementMutationByIdExecutorParams {
  executeMovementMutation: (mutation: (record: DailyRecord) => DailyRecord) => void;
}

export const usePatientMovementMutationByIdExecutor = ({
  executeMovementMutation,
}: UsePatientMovementMutationByIdExecutorParams) => {
  return useCallback(
    (mutation: (record: DailyRecord, id: string) => DailyRecord, id: string) => {
      executeMovementMutation(record => mutation(record, id));
    },
    [executeMovementMutation]
  );
};
