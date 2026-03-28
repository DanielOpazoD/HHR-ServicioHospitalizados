import React from 'react';
import {
  useAppState,
  useCensusEmail,
  useDailyRecord,
  useExistingDaysQuery,
  useFileOperations,
} from '@/hooks';
import { useSystemHealthReporter } from '@/hooks/admin/useSystemHealthReporter';
import type { UseAppStateReturn } from '@/hooks/useAppState';
import type { UseCensusEmailReturn } from '@/hooks/useCensusEmail';
import type { UseFileOperationsReturn } from '@/hooks/useFileOperations';
import type { DailyRecordContextType } from '@/hooks/useDailyRecordTypes';
import { resolveShiftNurseSignature } from '@/services/staff/dailyRecordStaffing';
import type { AuthContextType } from '@/context';
import type { CensusContextType } from '@/context/CensusContext';
import type { AppAuthenticatedDateNavigation } from '@/app-shell/bootstrap/useAppBootstrapState';

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

export const useAuthenticatedAppRuntime = ({
  auth,
  dateNav,
}: UseAuthenticatedAppRuntimeParams): AuthenticatedAppRuntime => {
  useSystemHealthReporter();

  const dailyRecordHook = useDailyRecord(
    dateNav.currentDateString,
    false,
    auth.isFirebaseConnected
  );
  const { record } = dailyRecordHook;

  const { data } = useExistingDaysQuery(dateNav.selectedYear, dateNav.selectedMonth);
  const existingDaysInMonth = React.useMemo(() => data ?? [], [data]);

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
  });

  const fileOps = useFileOperations(record, dailyRecordHook.refresh);
  const ui = useAppState();

  const censusContextValue = React.useMemo<CensusContextType>(
    () => ({
      dailyRecord: dailyRecordHook,
      dateNav: {
        ...dateNav,
        existingDaysInMonth,
      },
      fileOps,
      censusEmail,
      nurseSignature,
    }),
    [censusEmail, dailyRecordHook, dateNav, existingDaysInMonth, fileOps, nurseSignature]
  );

  return React.useMemo(
    () => ({
      dailyRecordHook,
      existingDaysInMonth,
      nurseSignature,
      censusEmail,
      fileOps,
      ui,
      censusContextValue,
    }),
    [
      censusContextValue,
      censusEmail,
      dailyRecordHook,
      existingDaysInMonth,
      fileOps,
      nurseSignature,
      ui,
    ]
  );
};
