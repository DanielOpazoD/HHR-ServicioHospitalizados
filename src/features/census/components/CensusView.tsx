import React, { Suspense, lazy } from 'react';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { SectionErrorBoundary } from '@/components/shared/SectionErrorBoundary';
import { AnalyticsView } from '@/features/analytics/public';
import { useCensusViewScreenModel } from '@/features/census/hooks/useCensusViewScreenModel';
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
  allowAdminCopyOverride?: boolean;
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
  allowAdminCopyOverride = false,
  localViewMode = 'TABLE',
  accessProfile = 'default',
}) => {
  const {
    branch,
    emptyDayPromptProps,
    registerContentProps,
    shouldDeferTodayEmptyState,
    resolvedTodayEmptyDate,
  } = useCensusViewScreenModel({
    viewMode,
    selectedDay,
    selectedMonth,
    currentDateString,
    showBedManagerModal,
    onCloseBedManagerModal,
    readOnly,
    allowAdminCopyOverride,
    localViewMode,
    accessProfile,
  });

  if (branch === 'analytics') {
    return (
      <SectionErrorBoundary sectionName="Estadísticas">
        <AnalyticsView />
      </SectionErrorBoundary>
    );
  }

  if (branch === 'empty') {
    if (shouldDeferTodayEmptyState && resolvedTodayEmptyDate !== currentDateString) {
      return <ViewLoader />;
    }

    return (
      <Suspense fallback={<ViewLoader />}>
        {emptyDayPromptProps ? <LazyEmptyDayPrompt {...emptyDayPromptProps} /> : null}
      </Suspense>
    );
  }

  return (
    <div className="space-y-4">
      <Suspense fallback={<ViewLoader />}>
        {registerContentProps ? <LazyCensusRegisterContent {...registerContentProps} /> : null}
      </Suspense>
    </div>
  );
};

// Exported component
export const CensusView: React.FC<CensusViewProps> = CensusViewContent;
