import type { ModuleType } from '@/constants/navigationConfig';
import type { UserRole } from '@/types/auth';
import { canEditModule, isAdmin } from '@/utils/permissions';

type SupportedRole = UserRole | string | undefined;

export const canForceCreateDayCopyOverride = (role: SupportedRole): boolean => isAdmin(role);

export const canVerifyArchiveStatusForModule = (
  role: SupportedRole,
  moduleType: ModuleType | string
): boolean => {
  if (moduleType === 'CENSUS') {
    return canEditModule(role, 'CENSUS');
  }

  if (moduleType === 'NURSING_HANDOFF') {
    return canEditModule(role, 'NURSING_HANDOFF');
  }

  return false;
};
