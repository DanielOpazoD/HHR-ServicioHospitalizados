import { useMemo } from 'react';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { resolveShiftNurseSignature } from '@/services/staff/dailyRecordStaffing';

export const useNurseSignature = (record: DailyRecord | null) => {
  return useMemo(() => resolveShiftNurseSignature(record, 'night'), [record]);
};

export type UseNurseSignatureReturn = ReturnType<typeof useNurseSignature>;
