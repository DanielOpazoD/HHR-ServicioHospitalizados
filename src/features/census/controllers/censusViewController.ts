import type { BedDefinition } from '@/types/domain/beds';
import type { Statistics } from '@/types/domain/statistics';
import type { DailyRecord } from '@/features/census/contracts/censusRecordContracts';
import type { CSSProperties } from 'react';
import type { CensusAccessProfile } from '@/features/census/types/censusAccessProfile';

type ViewMode = 'REGISTER' | 'ANALYTICS';

export type CensusViewBranch = 'analytics' | 'empty' | 'register';

export interface ResolveCensusViewBranchParams {
  viewMode: ViewMode;
  beds: DailyRecord['beds'] | null;
}

export interface BuildEmptyDayPromptPropsParams {
  selectedDay: number;
  selectedMonth: number;
  currentDateString: string;
  previousRecordAvailable: boolean;
  previousRecordDate: string | undefined;
  availableDates: string[];
  onCreateDay: (
    copyFromPrevious: boolean,
    specificDate?: string,
    options?: { forceCopyScheduleOverride?: boolean }
  ) => void | Promise<void>;
  readOnly: boolean;
  allowAdminCopyOverride: boolean;
}

export interface BuildRegisterContentPropsParams {
  currentDateString: string;
  readOnly: boolean;
  localViewMode: 'TABLE' | '3D';
  beds: DailyRecord['beds'];
  visibleBeds: BedDefinition[];
  marginStyle: CSSProperties;
  stats: Statistics | null;
  showBedManagerModal: boolean;
  onCloseBedManagerModal: () => void;
  accessProfile?: CensusAccessProfile;
}

export const resolveCensusViewBranch = ({
  viewMode,
  beds,
}: ResolveCensusViewBranchParams): CensusViewBranch => {
  if (viewMode === 'ANALYTICS') {
    return 'analytics';
  }

  return beds ? 'register' : 'empty';
};

export const buildEmptyDayPromptProps = ({
  selectedDay,
  selectedMonth,
  currentDateString,
  previousRecordAvailable,
  previousRecordDate,
  availableDates,
  onCreateDay,
  readOnly,
  allowAdminCopyOverride,
}: BuildEmptyDayPromptPropsParams) => ({
  selectedDay,
  selectedMonth,
  currentDateString,
  previousRecordAvailable,
  previousRecordDate,
  availableDates,
  onCreateDay,
  readOnly,
  allowAdminCopyOverride,
});

export const buildRegisterContentProps = ({
  currentDateString,
  readOnly,
  localViewMode,
  beds,
  visibleBeds,
  marginStyle,
  stats,
  showBedManagerModal,
  onCloseBedManagerModal,
  accessProfile,
}: BuildRegisterContentPropsParams) => ({
  currentDateString,
  readOnly,
  localViewMode,
  beds,
  visibleBeds,
  marginStyle,
  stats,
  showBedManagerModal,
  onCloseBedManagerModal,
  ...(accessProfile ? { accessProfile } : {}),
});
