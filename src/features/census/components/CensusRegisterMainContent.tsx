import React from 'react';
import { Loader2 } from 'lucide-react';
import type { BedDefinition } from '@/types/domain/base';
import type { DailyRecord } from '@/features/census/contracts/censusDomainContracts';
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

const HospitalFloorMap = React.lazy(() => import('./3d/HospitalFloorMap'));

export const CensusRegisterMainContent: React.FC<CensusRegisterMainContentProps> = ({
  localViewMode,
  currentDateString,
  readOnly,
  visibleBeds,
  beds,
  accessProfile,
}) => {
  if (localViewMode === 'TABLE') {
    return (
      <SectionErrorBoundary sectionName="Tabla de Pacientes" fallbackHeight="400px">
        <CensusTable
          currentDateString={currentDateString}
          readOnly={readOnly}
          accessProfile={accessProfile}
        />
      </SectionErrorBoundary>
    );
  }

  return (
    <div className="animate-fade-in">
      <React.Suspense
        fallback={
          <div className="h-[500px] w-full rounded-xl border border-slate-200 bg-slate-50 flex flex-col items-center justify-center">
            <Loader2 className="mb-2 animate-spin text-indigo-500" size={32} />
            <p className="text-sm font-medium text-slate-500">Cargando entorno 3D...</p>
          </div>
        }
      >
        <HospitalFloorMap beds={visibleBeds} patients={beds} />
      </React.Suspense>
    </div>
  );
};
