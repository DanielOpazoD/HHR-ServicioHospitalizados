import { useEffect, useState } from 'react';
import { useAuth } from '@/context';
import { useDailyRecordData } from '@/context/DailyRecordContext';
import { getTodayISO } from '@/utils/dateCoreUtils';
import { useCensusMigrationBootstrap } from './useCensusMigrationBootstrap';
import { useCensusViewRouteModel } from './useCensusViewRouteModel';
import type { CensusAccessProfile } from '../types/censusAccessProfile';
import { resolveCensusEmptyStatePolicy } from '@/hooks/controllers/dailyRecordBootstrapController';

interface UseCensusViewScreenModelParams {
  selectedDay: number;
  selectedMonth: number;
  currentDateString: string;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  readOnly: boolean;
  allowAdminCopyOverride: boolean;
  accessProfile: CensusAccessProfile;
}

export const useCensusViewScreenModel = ({
  selectedDay,
  selectedMonth,
  currentDateString,
  showBedManagerModal,
  onCloseBedManagerModal,
  readOnly,
  allowAdminCopyOverride,
  accessProfile,
}: UseCensusViewScreenModelParams) => {
  const auth = useAuth();
  const { bootstrapPhase } = useDailyRecordData();
  const routeModel = useCensusViewRouteModel({
    selectedDay,
    selectedMonth,
    currentDateString,
    showBedManagerModal,
    onCloseBedManagerModal,
    readOnly,
    allowAdminCopyOverride,
    accessProfile,
  });
  const [resolvedTodayEmptyDate, setResolvedTodayEmptyDate] = useState('');
  const { shouldDeferEmptyState: shouldDeferTodayEmptyState, deferMs: emptyStateDeferMs } =
    resolveCensusEmptyStatePolicy({
      branch: routeModel.branch,
      currentDateString,
      todayDateString: getTodayISO(),
      isAuthenticated: auth.isAuthenticated,
      bootstrapPhase:
        auth.remoteSyncStatus === 'bootstrapping' ? 'remote_runtime_bootstrapping' : bootstrapPhase,
    });

  useCensusMigrationBootstrap(true);

  useEffect(() => {
    if (!shouldDeferTodayEmptyState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setResolvedTodayEmptyDate(currentDateString);
    }, emptyStateDeferMs);

    return () => window.clearTimeout(timeoutId);
  }, [currentDateString, emptyStateDeferMs, shouldDeferTodayEmptyState]);

  return {
    ...routeModel,
    shouldDeferTodayEmptyState,
    resolvedTodayEmptyDate,
  };
};
