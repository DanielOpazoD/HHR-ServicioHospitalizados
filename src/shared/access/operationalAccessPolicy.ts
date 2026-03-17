import type { ModuleType } from '@/constants/navigationConfig';
import type { UserRole } from '@/types/auth';
import { canEditModule, canDoAction, isAdmin, ACTIONS } from '@/utils/permissions';
import { canReadClinicalDocuments } from '@/application/clinical-documents/clinicalDocumentAccessPolicy';
import {
  isSpecialistCensusAccessProfile,
  type CensusAccessProfile,
} from '@/shared/access/censusAccessProfile';
import { canEditSpecialistTodayBoundRecord } from '@/shared/access/specialistAccessPolicy';

type SupportedRole = UserRole | string | undefined;

export const canForceCreateDayCopyOverride = (role: SupportedRole): boolean => isAdmin(role);

export const canVerifyPassiveBackupForRole = (
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

export const canViewOrManageBackupFiles = (role: SupportedRole): boolean =>
  canEditModule(role, 'NURSING_HANDOFF');

export const canUseAdminMaintenanceActions = (role: SupportedRole): boolean => isAdmin(role);

export const canTriggerCensusExports = ({
  role,
  accessProfile = 'default',
}: {
  role: SupportedRole;
  accessProfile?: CensusAccessProfile;
}): boolean => canEditModule(role, 'CENSUS') && !isSpecialistCensusAccessProfile(accessProfile);

export const canOpenTransferDocuments = (role: SupportedRole): boolean =>
  canEditModule(role, 'TRANSFER_MANAGEMENT');

export const canViewPatientHistoryFromRestrictedProfiles = ({
  accessProfile = 'default',
  hasRut,
}: {
  accessProfile?: CensusAccessProfile;
  hasRut: boolean;
}): boolean => !isSpecialistCensusAccessProfile(accessProfile) && hasRut;

export const canVerifyArchiveStatusForModule = (
  role: SupportedRole,
  moduleType: ModuleType | string
): boolean => canVerifyPassiveBackupForRole(role, moduleType);

export const canEditMedicalHandoffForDate = ({
  role,
  readOnly,
  recordDate,
  todayISO,
}: {
  role: SupportedRole;
  readOnly: boolean;
  recordDate?: string;
  todayISO?: string;
}): boolean =>
  canEditSpecialistTodayBoundRecord({
    role,
    readOnly,
    recordDate,
    todayISO,
  });

export const canOpenClinicalDocumentsFromCensus = ({
  role,
  isBlocked,
  isEmpty,
  hasPatientName,
}: {
  role: SupportedRole;
  isBlocked: boolean;
  isEmpty: boolean;
  hasPatientName: boolean;
}): boolean =>
  !isBlocked &&
  !isEmpty &&
  hasPatientName &&
  canReadClinicalDocuments((typeof role === 'string' ? role : undefined) as UserRole | undefined);

export const canUseCensusUtilityActions = ({
  readOnly,
  accessProfile = 'default',
}: {
  readOnly: boolean;
  accessProfile?: CensusAccessProfile;
}): boolean => !readOnly && !isSpecialistCensusAccessProfile(accessProfile);

export const canResetOrDeleteDailyRecord = ({
  role,
  isToday,
}: {
  role: SupportedRole;
  isToday: boolean;
}): boolean => {
  if (isAdmin(role)) {
    return true;
  }

  if (!isToday) {
    return false;
  }

  return canDoAction(role, ACTIONS.RECORD_DELETE);
};
