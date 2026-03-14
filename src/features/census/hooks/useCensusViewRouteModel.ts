import { useMemo } from 'react';
import { useCensusViewModel } from '@/features/census/hooks/useCensusViewModel';
import {
  buildEmptyDayPromptProps,
  buildRegisterContentProps,
  resolveCensusViewBranch,
} from '@/features/census/controllers/censusViewController';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

type ViewMode = 'REGISTER' | 'ANALYTICS';

interface UseCensusViewRouteModelParams {
  viewMode: ViewMode;
  selectedDay: number;
  selectedMonth: number;
  currentDateString: string;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  readOnly: boolean;
  localViewMode: 'TABLE' | '3D';
  accessProfile: CensusAccessProfile;
}

export const useCensusViewRouteModel = ({
  viewMode,
  selectedDay,
  selectedMonth,
  currentDateString,
  showBedManagerModal,
  onCloseBedManagerModal,
  readOnly,
  localViewMode,
  accessProfile,
}: UseCensusViewRouteModelParams) => {
  const viewModel = useCensusViewModel(currentDateString);

  const branch = useMemo(
    () =>
      resolveCensusViewBranch({
        viewMode,
        beds: viewModel.beds,
      }),
    [viewMode, viewModel.beds]
  );

  const emptyDayPromptProps = useMemo(
    () =>
      buildEmptyDayPromptProps({
        selectedDay,
        selectedMonth,
        currentDateString,
        previousRecordAvailable: viewModel.previousRecordAvailable,
        previousRecordDate: viewModel.previousRecordDate,
        availableDates: viewModel.availableDates,
        onCreateDay: viewModel.createDay,
        readOnly,
      }),
    [
      currentDateString,
      readOnly,
      selectedDay,
      selectedMonth,
      viewModel.availableDates,
      viewModel.createDay,
      viewModel.previousRecordAvailable,
      viewModel.previousRecordDate,
    ]
  );

  const registerContentProps = useMemo(() => {
    if (!viewModel.beds) {
      return null;
    }

    return buildRegisterContentProps({
      currentDateString,
      readOnly,
      localViewMode,
      beds: viewModel.beds,
      visibleBeds: viewModel.visibleBeds,
      marginStyle: viewModel.marginStyle,
      stats: viewModel.stats,
      showBedManagerModal,
      onCloseBedManagerModal,
      accessProfile,
    });
  }, [
    accessProfile,
    currentDateString,
    localViewMode,
    onCloseBedManagerModal,
    readOnly,
    showBedManagerModal,
    viewModel.beds,
    viewModel.marginStyle,
    viewModel.stats,
    viewModel.visibleBeds,
  ]);

  return {
    branch,
    emptyDayPromptProps,
    registerContentProps,
  };
};
