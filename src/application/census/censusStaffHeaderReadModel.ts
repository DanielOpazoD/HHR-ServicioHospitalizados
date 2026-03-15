import type { Statistics } from '@/types';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import {
  resolveAdmissionsCountForRecord,
  resolveMovementSummaryState,
  resolveStaffSelectorsClassName,
  resolveStaffSelectorsState,
} from '@/features/census/controllers/censusStaffHeaderController';
import type { DischargeData, PatientData, TransferData } from '@/types';

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
  beds?: Record<string, PatientData> | null;
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
