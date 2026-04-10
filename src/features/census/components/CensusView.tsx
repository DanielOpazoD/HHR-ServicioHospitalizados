import React, { Suspense, lazy } from 'react';
import { ViewLoader } from '@/components/ui/ViewLoader';
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

interface CensusViewProps {
  selectedDay: number;
  selectedMonth: number;
  currentDateString: string;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  onOpenCensusDate?: (date: string) => void;
  readOnly?: boolean;
  allowAdminCopyOverride?: boolean;
  accessProfile?: CensusAccessProfile;
}

const CensusViewContent: React.FC<CensusViewProps> = ({
  selectedDay,
  selectedMonth,
  currentDateString,
  showBedManagerModal,
  onCloseBedManagerModal,
  onOpenCensusDate: _onOpenCensusDate,
  readOnly = false,
  allowAdminCopyOverride = false,
  accessProfile = 'default',
}) => {
  const {
    branch,
    emptyDayPromptProps,
    registerContentProps,
    shouldDeferTodayEmptyState,
    resolvedTodayEmptyDate,
  } = useCensusViewScreenModel({
    selectedDay,
    selectedMonth,
    currentDateString,
    showBedManagerModal,
    onCloseBedManagerModal,
    readOnly,
    allowAdminCopyOverride,
    accessProfile,
  });

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
