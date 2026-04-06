import React from 'react';
import type { BedDefinition } from '@/features/census/contracts/censusBedContracts';
import type { DailyRecord } from '@/features/census/contracts/censusRecordContracts';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { CensusTable } from './CensusTable';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

interface CensusRegisterMainContentProps {
  localViewMode: 'TABLE' | '3D';
  currentDateString: string;
  readOnly: boolean;
  visibleBeds: BedDefinition[];
  beds: DailyRecord['beds'];
  accessProfile: CensusAccessProfile;
}

export const CensusRegisterMainContent: React.FC<CensusRegisterMainContentProps> = ({
  localViewMode: _localViewMode,
  currentDateString,
  readOnly,
  visibleBeds: _visibleBeds,
  beds: _beds,
  accessProfile,
}) => (
  <SectionErrorBoundary sectionName="Tabla de Pacientes" fallbackHeight="400px">
    <CensusTable
      currentDateString={currentDateString}
      readOnly={readOnly}
      accessProfile={accessProfile}
    />
  </SectionErrorBoundary>
);
