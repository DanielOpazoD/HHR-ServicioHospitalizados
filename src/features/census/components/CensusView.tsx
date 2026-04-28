import React, { Suspense, lazy, useEffect, useRef, useState } from 'react';
import { ViewLoader } from '@/components/ui/ViewLoader';
import { useCensusViewScreenModel } from '@/features/census/hooks/useCensusViewScreenModel';
import { CensusRegisterContent } from './CensusRegisterContent';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

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

  // Show loader briefly on every date change so the empty-day prompt
  // never flashes before Firestore has a chance to deliver the record.
  const [settledDate, setSettledDate] = useState('');
  const prevDateRef = useRef(currentDateString);
  useEffect(() => {
    if (prevDateRef.current !== currentDateString) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional reset when the navigated date changes; cannot be derived during render
      setSettledDate('');
      prevDateRef.current = currentDateString;
    }
  }, [currentDateString]);

  useEffect(() => {
    if (branch === 'register') {
      // Data arrived — settle immediately.
      // eslint-disable-next-line react-hooks/set-state-in-effect -- we must commit the settled date only after Firestore delivers a record
      setSettledDate(currentDateString);
      return;
    }
    // For empty branch, wait a grace period before committing.
    const id = window.setTimeout(() => setSettledDate(currentDateString), 800);
    return () => window.clearTimeout(id);
  }, [branch, currentDateString]);

  const isDateSettled = settledDate === currentDateString;

  if (branch === 'empty') {
    if (
      !isDateSettled ||
      (shouldDeferTodayEmptyState && resolvedTodayEmptyDate !== currentDateString)
    ) {
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
      {registerContentProps ? <CensusRegisterContent {...registerContentProps} /> : null}
    </div>
  );
};

// Exported component
export const CensusView: React.FC<CensusViewProps> = CensusViewContent;
