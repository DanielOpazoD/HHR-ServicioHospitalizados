import React, { Suspense, lazy } from 'react';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { AnalyticsView } from '@/features/analytics/public';
import { useCensusMigrationBootstrap } from '@/features/census/hooks/useCensusMigrationBootstrap';
import { useCensusViewRouteModel } from '@/features/census/hooks/useCensusViewRouteModel';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

const LazyCensusRegisterContent = lazy(() =>
  import('./CensusRegisterContent').then(module => ({
    default: module.CensusRegisterContent,
  }))
);

const LazyEmptyDayPrompt = lazy(() =>
  import('./EmptyDayPrompt').then(module => ({
    default: module.EmptyDayPrompt,
  }))
);

type ViewMode = 'REGISTER' | 'ANALYTICS';

interface CensusViewProps {
  viewMode: ViewMode;
  selectedDay: number;
  selectedMonth: number;
  currentDateString: string;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  readOnly?: boolean;
  localViewMode?: 'TABLE' | '3D';
  accessProfile?: CensusAccessProfile;
}

const CensusViewContent: React.FC<CensusViewProps> = ({
  viewMode,
  selectedDay,
  selectedMonth,
  currentDateString,
  showBedManagerModal,
  onCloseBedManagerModal,
  readOnly = false,
  localViewMode = 'TABLE',
  accessProfile = 'default',
}) => {
  const { branch, emptyDayPromptProps, registerContentProps } = useCensusViewRouteModel({
    viewMode,
    selectedDay,
    selectedMonth,
    currentDateString,
    showBedManagerModal,
    onCloseBedManagerModal,
    readOnly,
    localViewMode,
    accessProfile,
  });

  useCensusMigrationBootstrap();

  if (branch === 'analytics') {
    return (
      <SectionErrorBoundary sectionName="Estadísticas">
        <AnalyticsView />
      </SectionErrorBoundary>
    );
  }

  if (branch === 'empty') {
    return (
      <Suspense fallback={<ViewLoader />}>
        <LazyEmptyDayPrompt {...emptyDayPromptProps} />
      </Suspense>
    );
  }

  return (
    <Suspense fallback={<ViewLoader />}>
      {registerContentProps ? <LazyCensusRegisterContent {...registerContentProps} /> : null}
    </Suspense>
  );
};

// Exported component
export const CensusView: React.FC<CensusViewProps> = CensusViewContent;
