import { useMemo, useRef, useEffect } from 'react';
import type { DailyRecord } from '@/hooks/contracts/dailyRecordHookContracts';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import { useNotification } from '@/context/UIContext';
import { useAuditContext } from '@/context/AuditContext';
import { useAuth } from '@/context';
import type { HandoffManagementActions } from '@/hooks/handoffManagementTypes';
import { useHandoffManagementPersistence } from '@/hooks/useHandoffManagementPersistence';
import { useHandoffManagementDelivery } from '@/hooks/useHandoffManagementDelivery';

export const useHandoffManagement = (
  record: DailyRecord | null,
  saveAndUpdate: (updatedRecord: DailyRecord) => Promise<void>,
  patchRecord: (partial: DailyRecordPatch) => Promise<void>
): HandoffManagementActions => {
  const { success, error: notifyError } = useNotification();
  const { logEvent, logDebouncedEvent, userId } = useAuditContext();
  const { role } = useAuth();
  const recordRef = useRef(record);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);

  const persistence = useHandoffManagementPersistence({
    recordRef,
    role,
    saveAndUpdate,
    logEvent,
    logDebouncedEvent,
    userId,
    notifyError,
  });
  const delivery = useHandoffManagementDelivery({
    recordRef,
    role,
    patchRecord,
    success,
    notifyError,
  });

  return useMemo(
    () => ({
      ...persistence,
      ...delivery,
    }),
    [delivery, persistence]
  );
};
