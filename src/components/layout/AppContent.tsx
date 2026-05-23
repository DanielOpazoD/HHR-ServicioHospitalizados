import React from 'react';
import { AppProviders } from '@/components/AppProviders';
import { UseUIStateReturn } from '@/hooks/useUIState';
import { AppContentChrome } from '@/components/layout/app-content/AppContentChrome';
import { AppContentOverlays } from '@/components/layout/app-content/AppContentOverlays';
import { useAppContentRuntime } from '@/components/layout/app-content/useAppContentRuntime';
import { useAppContentShellEffects } from '@/components/layout/app-content/useAppContentShellEffects';
import { buildOpenCensusDateHandler } from '@/components/layout/app-content/appContentCensusDateController';
import { resolveModuleTheme } from '@/components/layout/app-content/moduleThemeController';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';

interface AppContentProps {
  ui: UseUIStateReturn;
  renderFeatureQuickActions?: (patients: MedicalIndicationsPatientOption[]) => React.ReactNode;
}

type ReminderCenterProviderComponent = React.FC<{ children: React.ReactNode }>;

const loadReminderCenterProvider = async (): Promise<ReminderCenterProviderComponent> => {
  const module = await import('@/context/ReminderCenterContext');
  return module.ReminderCenterProvider;
};

const DeferredReminderCenterProvider: ReminderCenterProviderComponent = ({ children }) => {
  const [Provider, setProvider] = React.useState<ReminderCenterProviderComponent | null>(null);

  React.useEffect(() => {
    let mounted = true;
    void loadReminderCenterProvider().then(provider => {
      if (mounted) {
        setProvider(() => provider);
      }
    });
    return () => {
      mounted = false;
    };
  }, []);

  if (!Provider) {
    return <>{children}</>;
  }

  return <Provider>{children}</Provider>;
};

export const AppContent: React.FC<AppContentProps> = ({ ui, renderFeatureQuickActions }) => {
  const runtime = useAppContentRuntime({ ui });
  const { auth, dailyRecordHook, dateNav } = runtime;

  const openCensusDate = React.useMemo(
    () =>
      buildOpenCensusDateHandler({
        setCurrentModule: ui.setCurrentModule,
        setCensusViewMode: ui.setCensusViewMode,
        setSelectedYear: dateNav.setSelectedYear,
        setSelectedMonth: dateNav.setSelectedMonth,
        setSelectedDay: dateNav.setSelectedDay,
      }),
    [
      dateNav.setSelectedDay,
      dateNav.setSelectedMonth,
      dateNav.setSelectedYear,
      ui.setCensusViewMode,
      ui.setCurrentModule,
    ]
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
      <DeferredReminderCenterProvider>
        <div
          data-module={resolveModuleTheme(ui.currentModule)}
          className="min-h-screen bg-slate-100 font-sans flex flex-col print:bg-white print:p-0"
        >
          <AppContentChrome
            ui={ui}
            runtime={runtime}
            onOpenCensusDate={openCensusDate}
            renderFeatureQuickActions={renderFeatureQuickActions}
          />
          <AppContentOverlays ui={ui} runtime={runtime} onOpenCensusDate={openCensusDate} />
        </div>
      </DeferredReminderCenterProvider>
    </AppProviders>
  );
};
