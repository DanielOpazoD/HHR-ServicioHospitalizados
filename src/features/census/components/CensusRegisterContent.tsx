import React, { Suspense, lazy, type CSSProperties } from 'react';
import type { BedDefinition, Statistics } from '@/types/domain/base';
import type { DailyRecord } from '@/features/census/contracts/censusDomainContracts';
import { CensusActionsProvider } from './CensusActionsContext';
import { CensusPrintHeader } from './CensusPrintHeader';
import { CensusStaffHeader } from './CensusStaffHeader';
import { CensusRegisterMainContent } from './CensusRegisterMainContent';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

const LazyCensusRegisterSections = lazy(() =>
  import('./CensusRegisterSections').then(module => ({
    default: module.CensusRegisterSections,
  }))
);

interface CensusRegisterContentProps {
  currentDateString: string;
  readOnly: boolean;
  localViewMode: 'TABLE' | '3D';
  beds: DailyRecord['beds'];
  visibleBeds: BedDefinition[];
  marginStyle: CSSProperties;
  stats: Statistics | null;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  accessProfile?: CensusAccessProfile;
}

export const CensusRegisterContent: React.FC<CensusRegisterContentProps> = ({
  currentDateString,
  readOnly,
  localViewMode,
  beds,
  visibleBeds,
  marginStyle,
  stats,
  showBedManagerModal,
  onCloseBedManagerModal,
  accessProfile = 'default',
}) => (
  <CensusActionsProvider>
    <CensusPrintHeader currentDateString={currentDateString} />

    <div className="space-y-6" style={marginStyle}>
      <CensusStaffHeader readOnly={readOnly} stats={stats} accessProfile={accessProfile} />

      <CensusRegisterMainContent
        localViewMode={localViewMode}
        currentDateString={currentDateString}
        readOnly={readOnly}
        visibleBeds={visibleBeds}
        beds={beds}
        accessProfile={accessProfile}
      />

      <Suspense fallback={null}>
        <LazyCensusRegisterSections
          readOnly={readOnly}
          showBedManagerModal={showBedManagerModal}
          onCloseBedManagerModal={onCloseBedManagerModal}
          accessProfile={accessProfile}
        />
      </Suspense>
    </div>
  </CensusActionsProvider>
);
