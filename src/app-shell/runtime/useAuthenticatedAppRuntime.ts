import React from 'react';
import { useAppState } from '@/hooks/useAppState';
import { useCensusEmail } from '@/hooks/useCensusEmail';
import { useDailyRecord } from '@/hooks/useDailyRecord';
import { useExistingDaysQuery } from '@/hooks/useExistingDaysQuery';
import { useFileOperations } from '@/hooks/useFileOperations';
import type { UseAppStateReturn } from '@/hooks/useAppState';
import type { UseCensusEmailReturn } from '@/hooks/useCensusEmail';
import type { UseFileOperationsReturn } from '@/hooks/useFileOperations';
import type { DailyRecordContextType } from '@/context/dailyRecordContextContracts';
import { resolveShiftNurseSignature } from '@/services/staff/dailyRecordStaffing';
import type { AuthContextType } from '@/context';
import type { CensusContextType } from '@/context/CensusContext';
import type { AppAuthenticatedDateNavigation } from '@/app-shell/bootstrap/useAppBootstrapState';
import { markPerf } from '@/shared/runtime/perfAudit';
export interface AuthenticatedAppRuntime {
  dailyRecordHook: DailyRecordContextType;
  existingDaysInMonth: number[];
  nurseSignature: string;
  censusEmail: UseCensusEmailReturn;
  fileOps: UseFileOperationsReturn;
  ui: UseAppStateReturn;
  censusContextValue: CensusContextType;
}

interface UseAuthenticatedAppRuntimeParams {
  auth: AuthContextType;
  dateNav: AppAuthenticatedDateNavigation;
}

interface BuildCensusContextValueParams {
  dailyRecordHook: DailyRecordContextType;
  dateNav: AppAuthenticatedDateNavigation;
  existingDaysInMonth: number[];
  fileOps: UseFileOperationsReturn;
  censusEmail: UseCensusEmailReturn;
  nurseSignature: string;
}

interface BuildAuthenticatedAppRuntimeParams extends BuildCensusContextValueParams {
  ui: UseAppStateReturn;
}

export const resolveExistingDaysInMonth = (data: number[] | undefined): number[] => data ?? [];

export const buildAuthenticatedCensusContextValue = ({
  dailyRecordHook,
  dateNav,
  existingDaysInMonth,
  fileOps,
  censusEmail,
  nurseSignature,
}: BuildCensusContextValueParams): CensusContextType => ({
  dailyRecord: dailyRecordHook,
  dateNav: {
    ...dateNav,
    existingDaysInMonth,
  },
  fileOps,
  censusEmail,
  nurseSignature,
});

export const buildAuthenticatedAppRuntime = ({
  dailyRecordHook,
  dateNav,
  existingDaysInMonth,
  fileOps,
  censusEmail,
  nurseSignature,
  ui,
}: BuildAuthenticatedAppRuntimeParams): AuthenticatedAppRuntime => ({
  dailyRecordHook,
  existingDaysInMonth,
  nurseSignature,
  censusEmail,
  fileOps,
  ui,
  censusContextValue: buildAuthenticatedCensusContextValue({
    dailyRecordHook,
    dateNav,
    existingDaysInMonth,
    fileOps,
    censusEmail,
    nurseSignature,
  }),
});

export const useAuthenticatedAppRuntime = ({
  auth,
  dateNav,
}: UseAuthenticatedAppRuntimeParams): AuthenticatedAppRuntime => {
  const ui = useAppState();
  const shouldRunCensusRuntimeExtras = ui.currentModule === 'CENSUS';
  const dailyRecordHook = useDailyRecord(dateNav.currentDateString, false, auth.remoteSyncStatus);
  const { record } = dailyRecordHook;

  const { data } = useExistingDaysQuery(dateNav.selectedYear, dateNav.selectedMonth, {
    enabled: shouldRunCensusRuntimeExtras,
  });
  React.useEffect(() => {
    if (shouldRunCensusRuntimeExtras && data) {
      markPerf('existing-days:ready', `${dateNav.selectedYear}-${dateNav.selectedMonth + 1}`);
    }
  }, [data, dateNav.selectedMonth, dateNav.selectedYear, shouldRunCensusRuntimeExtras]);

  const existingDaysInMonth = React.useMemo(() => resolveExistingDaysInMonth(data), [data]);

  const nurseSignature = React.useMemo(() => resolveShiftNurseSignature(record, 'night'), [record]);

  const censusEmail = useCensusEmail({
    record,
    currentDateString: dateNav.currentDateString,
    nurseSignature,
    selectedYear: dateNav.selectedYear,
    selectedMonth: dateNav.selectedMonth,
    selectedDay: dateNav.selectedDay,
    user: auth.currentUser,
    role: auth.role,
    enabled: shouldRunCensusRuntimeExtras,
  });

  const fileOps = useFileOperations(record, dailyRecordHook.refresh);

  return React.useMemo(
    () =>
      buildAuthenticatedAppRuntime({
        dailyRecordHook,
        dateNav,
        existingDaysInMonth,
        fileOps,
        censusEmail,
        nurseSignature,
        ui,
      }),
    [censusEmail, dailyRecordHook, dateNav, existingDaysInMonth, fileOps, nurseSignature, ui]
  );
};
