import type { UserRole } from '@/types/auth';
import { getPreviousDay, normalizeDateOnly } from '@/utils/clinicalDayUtils';
import { getTodayISO } from '@/utils/dateFormattingUtils';
import { ACTIONS, canDoAction } from '@/utils/permissions';

type SupportedRole = UserRole | string | undefined;

export const canEditCudyrRecord = ({
  role,
  readOnly,
  recordDate,
  todayISO = getTodayISO(),
}: {
  role: SupportedRole;
  readOnly: boolean;
  recordDate?: string;
  todayISO?: string;
}): boolean => {
  if (readOnly) {
    return false;
  }

  if (role === 'admin') {
    return true;
  }

  if (!canDoAction(role, ACTIONS.CUDYR_EDIT)) {
    return false;
  }

  const normalizedRecordDate = normalizeDateOnly(recordDate);
  const normalizedTodayISO = normalizeDateOnly(todayISO);
  if (!normalizedRecordDate || !normalizedTodayISO) {
    return false;
  }

  return (
    normalizedRecordDate === normalizedTodayISO ||
    normalizedRecordDate === getPreviousDay(normalizedTodayISO)
  );
};
