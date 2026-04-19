import React from 'react';
import { AppContent } from '@/components/layout/AppContent';
import { CensusProvider } from '@/context/CensusContext';
import { type AuthContextType } from '@/context';
import { type AppAuthenticatedDateNavigation } from '@/app-shell/bootstrap/useAppBootstrapState';
import { DeferredSystemHealthReporter } from '@/app-shell/runtime/DeferredSystemHealthReporter';
import { useAuthenticatedAppRuntime } from '@/app-shell/runtime/useAuthenticatedAppRuntime';
import type { MedicalIndicationsPatientOption } from '@/shared/contracts/medicalIndications';
import { lazyWithRetry } from '@/utils/lazyWithRetry';

const LaboratoryQuickAction = lazyWithRetry(() =>
  import('@/features/laboratory').then(module => ({
    default: module.LaboratoryQuickAction,
  }))
);

interface AuthenticatedAppShellProps {
  auth: AuthContextType;
  dateNav: AppAuthenticatedDateNavigation;
}

export const AuthenticatedAppShell = ({ auth, dateNav }: AuthenticatedAppShellProps) => {
  const { censusContextValue, ui } = useAuthenticatedAppRuntime({ auth, dateNav });
  const renderFeatureQuickActions = React.useCallback(
    (patients: MedicalIndicationsPatientOption[]) => (
      <React.Suspense fallback={null}>
        <LaboratoryQuickAction patients={patients} />
      </React.Suspense>
    ),
    []
  );

  return (
    <CensusProvider value={censusContextValue}>
      <DeferredSystemHealthReporter />
      <AppContent ui={ui} renderFeatureQuickActions={renderFeatureQuickActions} />
    </CensusProvider>
  );
};
