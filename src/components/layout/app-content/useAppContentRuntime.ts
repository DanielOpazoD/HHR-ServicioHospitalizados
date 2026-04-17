import React from 'react';
import type { AuthContextType } from '@/context/AuthContext';
import type { CensusContextType } from '@/context/CensusContext';
import { useCensusContext } from '@/context/CensusContext';
import { useAuth } from '@/context/AuthContext';
import { useExportManager, type UseExportManagerReturn } from '@/hooks/useExportManager';
import type { UseUIStateReturn } from '@/hooks/useUIState';
import {
  resolveSpecialistCapabilities,
  resolveSpecialistCensusAccessProfile,
  type SpecialistCapabilities,
} from '@/shared/access/specialistAccessPolicy';
import {
  canTriggerCensusExports,
  canVerifyPassiveBackupForRole,
} from '@/shared/access/operationalAccessPolicy';

const loadCensusMasterExcelExporter = async () =>
  import('@/services/exporters/censusMasterExport').then(
    module => module.generateCensusMasterExcel
  );

export interface AppContentRuntime {
  auth: AuthContextType;
  dailyRecordHook: CensusContextType['dailyRecord'];
  record: CensusContextType['dailyRecord']['record'];
  syncStatus: CensusContextType['dailyRecord']['syncStatus'];
  lastSyncTime: CensusContextType['dailyRecord']['lastSyncTime'];
  dateNav: CensusContextType['dateNav'];
  censusEmail: CensusContextType['censusEmail'];
  fileOps: CensusContextType['fileOps'];
  nurseSignature: CensusContextType['nurseSignature'];
  specialistCapabilities: SpecialistCapabilities;
  censusAccessProfile: ReturnType<typeof resolveSpecialistCensusAccessProfile>;
  canUseCensusExports: boolean;
  canVerifyArchiveStatus: boolean;
  exportManager: UseExportManagerReturn;
  handleExportExcel: () => Promise<void>;
}

interface UseAppContentRuntimeParams {
  ui: UseUIStateReturn;
}

const resolveAppContentAccess = (role: AuthContextType['role'], currentModule: string) => {
  const censusAccessProfile = resolveSpecialistCensusAccessProfile(role);
  return {
    specialistCapabilities: resolveSpecialistCapabilities(role),
    censusAccessProfile,
    canUseCensusExports: canTriggerCensusExports({
      role,
      accessProfile: censusAccessProfile,
    }),
    canVerifyArchiveStatus: canVerifyPassiveBackupForRole(role, currentModule),
  };
};

const resolveExportManagerParams = (
  dateNav: CensusContextType['dateNav'],
  ui: UseUIStateReturn,
  record: CensusContextType['dailyRecord']['record'],
  canVerifyArchiveStatus: boolean
) => ({
  currentDateString: dateNav.currentDateString,
  selectedYear: dateNav.selectedYear,
  selectedMonth: dateNav.selectedMonth,
  selectedDay: dateNav.selectedDay,
  record,
  currentModule: ui.currentModule,
  selectedShift: ui.selectedShift,
  canVerifyArchiveStatus,
});

const resolveExcelExportDateArgs = (dateNav: CensusContextType['dateNav']) =>
  [dateNav.selectedYear, dateNav.selectedMonth, dateNav.selectedDay] as const;

export const useAppContentRuntime = ({ ui }: UseAppContentRuntimeParams): AppContentRuntime => {
  const {
    dailyRecord: dailyRecordHook,
    dateNav,
    censusEmail,
    fileOps,
    nurseSignature,
  } = useCensusContext();
  const auth = useAuth();
  const { record, syncStatus, lastSyncTime } = dailyRecordHook;
  const { currentDateString: _currentDateString } = dateNav;

  const {
    specialistCapabilities,
    censusAccessProfile,
    canUseCensusExports,
    canVerifyArchiveStatus,
  } = React.useMemo(
    () => resolveAppContentAccess(auth.role, ui.currentModule),
    [auth.role, ui.currentModule]
  );

  const exportManager = useExportManager(
    React.useMemo(
      () => resolveExportManagerParams(dateNav, ui, record, canVerifyArchiveStatus),
      [canVerifyArchiveStatus, dateNav, record, ui]
    )
  );

  const handleExportExcel = React.useCallback(async () => {
    const generateCensusMasterExcel = await loadCensusMasterExcelExporter();
    await generateCensusMasterExcel(...resolveExcelExportDateArgs(dateNav));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dateNav is an unstable context object; tracking only its date parts keeps the callback stable
  }, [dateNav.selectedDay, dateNav.selectedMonth, dateNav.selectedYear]);

  return React.useMemo(
    () => ({
      auth,
      dailyRecordHook,
      record,
      syncStatus,
      lastSyncTime,
      dateNav,
      censusEmail,
      fileOps,
      nurseSignature,
      specialistCapabilities,
      censusAccessProfile,
      canUseCensusExports,
      canVerifyArchiveStatus,
      exportManager,
      handleExportExcel,
    }),
    [
      auth,
      canUseCensusExports,
      canVerifyArchiveStatus,
      censusAccessProfile,
      censusEmail,
      dailyRecordHook,
      dateNav,
      exportManager,
      fileOps,
      handleExportExcel,
      lastSyncTime,
      nurseSignature,
      record,
      specialistCapabilities,
      syncStatus,
    ]
  );
};
