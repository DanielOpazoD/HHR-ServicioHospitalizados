import React from 'react';
import type { AuthContextType } from '@/context/AuthContext';
import type { UseUIStateReturn } from '@/hooks/useUIState';
import { sanitizeAppModuleForRole } from '@/shared/access/operationalAccessPolicy';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryRecorder';
import { useAppContentEventBridge } from '@/components/layout/app-content/useAppContentEventBridge';

interface UseAppContentShellEffectsParams {
  role: AuthContextType['role'];
  currentModule: UseUIStateReturn['currentModule'];
  setCurrentModule: UseUIStateReturn['setCurrentModule'];
  isSignatureMode: boolean;
  setSelectedShift: UseUIStateReturn['setSelectedShift'];
}

const buildAppShellReadyTelemetry = (
  role: AuthContextType['role'],
  currentModule: UseUIStateReturn['currentModule']
) => ({
  category: 'daily_record' as const,
  operation: 'app_shell_ready' as const,
  status: 'success' as const,
  context: {
    module: currentModule,
    role: role || 'viewer',
  },
});

export const useAppContentShellEffects = ({
  role,
  currentModule,
  setCurrentModule,
  isSignatureMode,
  setSelectedShift,
}: UseAppContentShellEffectsParams): void => {
  const appShellTelemetryRecordedRef = React.useRef(false);

  useAppContentEventBridge({
    setCurrentModule,
    setSelectedShift,
  });

  React.useEffect(() => {
    const sanitizedModule = sanitizeAppModuleForRole(role, currentModule);
    if (sanitizedModule !== currentModule) {
      setCurrentModule(sanitizedModule);
    }
  }, [currentModule, role, setCurrentModule]);

  React.useEffect(() => {
    if (appShellTelemetryRecordedRef.current || isSignatureMode) {
      return;
    }

    recordOperationalTelemetry(buildAppShellReadyTelemetry(role, currentModule), {
      allowSuccess: true,
    });
    appShellTelemetryRecordedRef.current = true;
  }, [currentModule, isSignatureMode, role]);
};
