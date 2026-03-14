import React from 'react';
import { Statistics } from '@/types';
import { NurseSelector } from './NurseSelector';
import { TensSelector } from './TensSelector';
import { CombinedSummaryCard } from '@/components/layout/SummaryCard';
import {
  useDailyRecordData,
  useDailyRecordBeds,
  useDailyRecordStaff,
  useDailyRecordMovements,
} from '@/context/DailyRecordContext';
import { useDailyRecordStaffActions } from '@/context/useDailyRecordScopedActions';
import { useStaffContext } from '@/context/StaffContext';
import {
  resolveAdmissionsCountForRecord,
  resolveMovementSummaryState,
  resolveStaffSelectorsClassName,
  resolveStaffSelectorsState,
} from '@/features/census/controllers/censusStaffHeaderController';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';

interface CensusStaffHeaderProps {
  readOnly?: boolean;
  stats: Statistics | null;
  accessProfile?: CensusAccessProfile;
}

/**
 * CensusStaffHeader
 * Displays staff selectors (Nurse/TENS) and summary statistics.
 * Optimized to consume fragmented context.
 */
export const CensusStaffHeader: React.FC<CensusStaffHeaderProps> = ({
  readOnly = false,
  stats,
  accessProfile = 'default',
}) => {
  const dailyRecordData = useDailyRecordData();
  const beds = useDailyRecordBeds();
  const staffData = useDailyRecordStaff();
  const movementsData = useDailyRecordMovements();

  const { updateNurse, updateTens } = useDailyRecordStaffActions();
  const { nursesList, tensList } = useStaffContext();
  const staffSelectorsState = resolveStaffSelectorsState(staffData);
  const admissionsCount = resolveAdmissionsCountForRecord({
    beds,
    recordDate: dailyRecordData.record?.date,
  });
  const movementSummaryState = resolveMovementSummaryState({
    ...(movementsData || {}),
    admissionsCount,
  });
  const selectorsClassName = resolveStaffSelectorsClassName(readOnly);
  const specialistAccess = isSpecialistCensusAccessProfile(accessProfile);

  return (
    <div className="flex justify-center items-stretch gap-3 flex-wrap animate-fade-in px-4">
      {/* Staff Selectors */}
      {!specialistAccess && (
        <NurseSelector
          nursesDayShift={staffSelectorsState.nursesDayShift}
          nursesNightShift={staffSelectorsState.nursesNightShift}
          nursesList={nursesList}
          onUpdateNurse={updateNurse}
          className={selectorsClassName}
        />
      )}

      {!specialistAccess && (
        <TensSelector
          tensDayShift={staffSelectorsState.tensDayShift}
          tensNightShift={staffSelectorsState.tensNightShift}
          tensList={tensList}
          onUpdateTens={updateTens}
          className={selectorsClassName}
        />
      )}

      {/* Combined Stats Summary Card */}
      {stats && !specialistAccess && (
        <CombinedSummaryCard
          stats={stats}
          discharges={movementSummaryState.discharges}
          transfers={movementSummaryState.transfers}
          cmaCount={movementSummaryState.cmaCount}
          newAdmissions={movementSummaryState.admissionsCount}
        />
      )}
    </div>
  );
};
