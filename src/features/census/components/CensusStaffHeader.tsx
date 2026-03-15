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
import { buildCensusStaffHeaderReadModel } from '@/application/census/censusStaffHeaderReadModel';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

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
  const readModel = buildCensusStaffHeaderReadModel({
    readOnly,
    stats,
    accessProfile,
    beds,
    recordDate: dailyRecordData.record?.date,
    staffData,
    movementsData,
  });

  return (
    <div className="flex justify-center items-start gap-3 flex-wrap animate-fade-in px-4">
      {/* Staff Selectors */}
      {!readModel.specialistAccess && (
        <NurseSelector
          nursesDayShift={readModel.staffSelectorsState.nursesDayShift}
          nursesNightShift={readModel.staffSelectorsState.nursesNightShift}
          nursesList={nursesList}
          onUpdateNurse={updateNurse}
          className={readModel.selectorsClassName}
        />
      )}

      {!readModel.specialistAccess && (
        <TensSelector
          tensDayShift={readModel.staffSelectorsState.tensDayShift}
          tensNightShift={readModel.staffSelectorsState.tensNightShift}
          tensList={tensList}
          onUpdateTens={updateTens}
          className={readModel.selectorsClassName}
        />
      )}

      {/* Combined Stats Summary Card */}
      {readModel.showSummary && stats && (
        <CombinedSummaryCard
          stats={stats}
          discharges={readModel.movementSummaryState.discharges}
          transfers={readModel.movementSummaryState.transfers}
          cmaCount={readModel.movementSummaryState.cmaCount}
          newAdmissions={readModel.movementSummaryState.admissionsCount}
        />
      )}
    </div>
  );
};
