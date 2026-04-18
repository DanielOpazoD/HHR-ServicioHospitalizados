import { useMemo, useCallback } from 'react';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { DailyRecordPatch } from '@/context/dailyRecordContextContracts';
import { useLatestRef } from '@/hooks/useLatestRef';
import type { DailyRecordStaffingDetailsV1 } from '@/types/domain/dailyRecordStaffingDetails';
import {
  buildDetailedStaffingPatch,
  resolveDetailedStaffingState,
  updateDetailedStaffingStandardSlot,
} from '@/services/staff/dailyRecordDetailedStaffing';

export const useNurseManagement = (
  record: DailyRecord | null,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
) => {
  const recordRef = useLatestRef(record);

  const updateNurse = useCallback(
    async (shift: 'day' | 'night', index: number, name: string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      const detail = resolveDetailedStaffingState(currentRecord, currentRecord.date);
      const updatedDetail = updateDetailedStaffingStandardSlot(detail, shift, 'nurse', index, name);
      await patchRecord(buildDetailedStaffingPatch(updatedDetail));
    },
    [patchRecord, recordRef]
  );

  return useMemo(
    () => ({
      updateNurse,
    }),
    [updateNurse]
  );
};

export const useTensManagement = (
  record: DailyRecord | null,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
) => {
  const recordRef = useLatestRef(record);

  const updateTens = useCallback(
    async (shift: 'day' | 'night', index: number, name: string) => {
      const currentRecord = recordRef.current;
      if (!currentRecord) return;

      const detail = resolveDetailedStaffingState(currentRecord, currentRecord.date);
      const updatedDetail = updateDetailedStaffingStandardSlot(detail, shift, 'tens', index, name);
      await patchRecord(buildDetailedStaffingPatch(updatedDetail));
    },
    [patchRecord, recordRef]
  );

  return useMemo(
    () => ({
      updateTens,
    }),
    [updateTens]
  );
};

export const useDetailedStaffingManagement = (
  record: DailyRecord | null,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
) => {
  const recordRef = useLatestRef(record);

  const updateDetailedStaffing = useCallback(
    async (detail: DailyRecordStaffingDetailsV1) => {
      if (!recordRef.current) return;
      await patchRecord(buildDetailedStaffingPatch(detail));
    },
    [patchRecord, recordRef]
  );

  return useMemo(
    () => ({
      updateDetailedStaffing,
    }),
    [updateDetailedStaffing]
  );
};
