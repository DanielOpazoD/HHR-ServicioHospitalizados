import { useCallback } from 'react';
import type {
  ApplyDailyRecordPatch,
  DailyRecord,
} from '@/application/shared/dailyRecordCoreContracts';
import type { DischargeMovementActions } from '@/types/movements';
import { convertDischargeToTransferRecord } from '@/application/census/dischargeToTransferPolicy';
import { useLatestRef } from './useLatestRef';

export const useDischargeToTransfer = (
  record: DailyRecord | null,
  patchRecord?: ApplyDailyRecordPatch
): DischargeMovementActions['convertDischargeToTransfer'] => {
  const recordRef = useLatestRef(record);
  return useCallback(
    async (id, payload, recordDate) => {
      const current = recordRef.current;
      if (!current || current.date !== recordDate) {
        throw new Error('Cambió el día del censo. Vuelva a abrir la conversión.');
      }
      const updated = convertDischargeToTransferRecord(current, id, payload, () =>
        crypto.randomUUID()
      );
      if (!patchRecord) {
        throw new Error('La conversión requiere el guardado parcial del censo.');
      }
      await patchRecord({ discharges: updated.discharges, transfers: updated.transfers });
    },
    [patchRecord, recordRef]
  );
};
