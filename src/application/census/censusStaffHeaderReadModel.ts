import type { Statistics } from '@/types/domain/statistics';
import type { CensusHeaderPatientContract } from '@/application/census/censusStaffHeaderContracts';
import {
  type CensusAccessProfile,
  isSpecialistCensusAccessProfile,
  resolveAdmissionsCountForRecord,
  resolveMovementSummaryState,
  resolveStaffSelectorsClassName,
  resolveStaffSelectorsState,
} from '@/features/census/public';
import type { DischargeData, TransferData } from '@/types/domain/movements';

interface CensusStaffData {
  nursesDayShift?: string[] | null;
  nursesNightShift?: string[] | null;
  tensDayShift?: string[] | null;
  tensNightShift?: string[] | null;
}

interface CensusMovementsData {
  discharges?: DischargeData[] | null;
  transfers?: TransferData[] | null;
  cma?: Array<{ id: string }> | null;
}

export const buildCensusStaffHeaderReadModel = ({
  readOnly,
  stats,
  accessProfile,
  beds,
  recordDate,
  staffData,
  movementsData,
}: {
  readOnly: boolean;
  stats: Statistics | null;
  accessProfile: CensusAccessProfile;
  beds?: Record<string, CensusHeaderPatientContract | undefined> | null;
  recordDate?: string;
  staffData?: CensusStaffData | null;
  movementsData?: CensusMovementsData | null;
}) => {
  const staffSelectorsState = resolveStaffSelectorsState(staffData);
  const admissionsCount = resolveAdmissionsCountForRecord({
    beds,
    recordDate,
  });
  const movementSummaryState = resolveMovementSummaryState({
    ...(movementsData || {}),
    admissionsCount,
  });
  const specialistAccess = isSpecialistCensusAccessProfile(accessProfile);

  return {
    specialistAccess,
    staffSelectorsState,
    movementSummaryState,
    selectorsClassName: resolveStaffSelectorsClassName(readOnly),
    showSummary: Boolean(stats) && !specialistAccess,
  };
};
