import type { UserRole } from '@/types/auth';
import { getTodayISO } from '@/utils/dateFormattingUtils';
import { canEditCudyrForDate } from '@/shared/access/operationalAccessPolicy';

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
}): boolean =>
  canEditCudyrForDate({
    role,
    readOnly,
    recordDate,
    todayISO,
  });
