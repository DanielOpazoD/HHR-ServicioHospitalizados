import { useEffect, useState } from 'react';
import { getTodayISO } from '@/utils/dateUtils';
import { useCensusMigrationBootstrap } from './useCensusMigrationBootstrap';
import { useCensusViewRouteModel } from './useCensusViewRouteModel';
import type { CensusAccessProfile } from '../types/censusAccessProfile';

type ViewMode = 'REGISTER' | 'ANALYTICS';

interface UseCensusViewScreenModelParams {
  viewMode: ViewMode;
  selectedDay: number;
  selectedMonth: number;
  currentDateString: string;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  readOnly: boolean;
  allowAdminCopyOverride: boolean;
  localViewMode: 'TABLE' | '3D';
  accessProfile: CensusAccessProfile;
}

export const useCensusViewScreenModel = ({
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
}: UseCensusViewScreenModelParams) => {
  const routeModel = useCensusViewRouteModel({
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
  const [resolvedTodayEmptyDate, setResolvedTodayEmptyDate] = useState('');
  const shouldDeferTodayEmptyState =
    routeModel.branch === 'empty' && currentDateString === getTodayISO();

  useCensusMigrationBootstrap(routeModel.branch !== 'analytics');

  useEffect(() => {
    if (!shouldDeferTodayEmptyState) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setResolvedTodayEmptyDate(currentDateString);
    }, 1200);

    return () => window.clearTimeout(timeoutId);
  }, [shouldDeferTodayEmptyState, currentDateString]);

  return {
    ...routeModel,
    shouldDeferTodayEmptyState,
    resolvedTodayEmptyDate,
  };
};
