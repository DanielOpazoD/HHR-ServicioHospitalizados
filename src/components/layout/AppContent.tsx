import React from 'react';
import { AppProviders } from '@/components/AppProviders';
import { UseUIStateReturn } from '@/hooks/useUIState';
import { ReminderCenterProvider } from '@/context/ReminderCenterContext';
import { AppContentChrome } from '@/components/layout/app-content/AppContentChrome';
import { AppContentOverlays } from '@/components/layout/app-content/AppContentOverlays';
import { useAppContentRuntime } from '@/components/layout/app-content/useAppContentRuntime';
import { useAppContentShellEffects } from '@/components/layout/app-content/useAppContentShellEffects';
import { resolveCensusDateSelection } from '@/components/layout/app-content/appContentCensusDateController';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

interface AppContentProps {
  ui: UseUIStateReturn;
  renderFeatureQuickActions?: (patients: MedicalIndicationsPatientOption[]) => React.ReactNode;
}

export const AppContent: React.FC<AppContentProps> = ({ ui, renderFeatureQuickActions }) => {
  const runtime = useAppContentRuntime({ ui });
  const { auth, dailyRecordHook, dateNav } = runtime;

  const openCensusDate = React.useCallback(
    (isoDate: string) => {
      const selection = resolveCensusDateSelection(isoDate);
      if (!selection) return;
      ui.setCurrentModule('CENSUS');
      ui.setCensusViewMode('REGISTER');
      dateNav.setSelectedYear(selection.year);
      dateNav.setSelectedMonth(selection.month);
      dateNav.setSelectedDay(selection.day);
    },
    [dateNav, ui]
  );

  useAppContentShellEffects({
    role: auth.role,
    currentModule: ui.currentModule,
    setCurrentModule: ui.setCurrentModule,
    isSignatureMode: dateNav.isSignatureMode,
    setSelectedShift: ui.setSelectedShift,
  });

  return (
    <AppProviders dailyRecordHook={dailyRecordHook}>
      <ReminderCenterProvider>
        <div className="min-h-screen bg-slate-100 font-sans flex flex-col print:bg-white print:p-0">
          <AppContentChrome
            ui={ui}
            runtime={runtime}
            renderFeatureQuickActions={renderFeatureQuickActions}
          />
          <AppContentOverlays ui={ui} runtime={runtime} onOpenCensusDate={openCensusDate} />
        </div>
      </ReminderCenterProvider>
    </AppProviders>
  );
};
