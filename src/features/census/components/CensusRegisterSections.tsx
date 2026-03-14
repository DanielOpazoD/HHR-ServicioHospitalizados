import React from 'react';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { CMASection } from '@/features/census/components/CMASection';
import { CensusModals } from '@/features/census/components/CensusModals';
import { DischargesSection } from '@/features/census/components/DischargesSection';
import { TransfersSection } from '@/features/census/components/TransfersSection';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';
import { isSpecialistCensusAccessProfile } from '@/features/census/types/censusAccessProfile';

interface CensusRegisterSectionsProps {
  readOnly: boolean;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  accessProfile: CensusAccessProfile;
}

export const CensusRegisterSections: React.FC<CensusRegisterSectionsProps> = ({
  readOnly,
  showBedManagerModal,
  onCloseBedManagerModal,
  accessProfile,
}) => (
  <>
    {!isSpecialistCensusAccessProfile(accessProfile) && (
      <SectionErrorBoundary sectionName="Altas del Día" fallbackHeight="100px">
        <DischargesSection />
      </SectionErrorBoundary>
    )}

    {!isSpecialistCensusAccessProfile(accessProfile) && (
      <SectionErrorBoundary sectionName="Traslados del Día" fallbackHeight="100px">
        <TransfersSection />
      </SectionErrorBoundary>
    )}

    {!isSpecialistCensusAccessProfile(accessProfile) && (
      <SectionErrorBoundary sectionName="Cirugía Mayor Ambulatoria" fallbackHeight="100px">
        <CMASection />
      </SectionErrorBoundary>
    )}

    {!readOnly && !isSpecialistCensusAccessProfile(accessProfile) && (
      <CensusModals
        showBedManagerModal={showBedManagerModal}
        onCloseBedManagerModal={onCloseBedManagerModal}
      />
    )}
  </>
);
