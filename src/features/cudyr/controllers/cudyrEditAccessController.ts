import type { UserRole } from '@/types/authRoleTypes';
import { getTodayISO } from '@/utils/dateCoreUtils';
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
