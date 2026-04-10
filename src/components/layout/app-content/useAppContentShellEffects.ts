import React from 'react';
import type { AuthContextType } from '@/context/AuthContext';
import type { UseUIStateReturn } from '@/hooks/useUIState';
import { sanitizeAppModuleForRole } from '@/shared/access/operationalAccessPolicy';
import { recordOperationalTelemetry } from '@/services/observability/operationalTelemetryService';
import { useAppContentEventBridge } from '@/components/layout/app-content/useAppContentEventBridge';

interface UseAppContentShellEffectsParams {
  role: AuthContextType['role'];
  currentModule: UseUIStateReturn['currentModule'];
  setCurrentModule: UseUIStateReturn['setCurrentModule'];
  isSignatureMode: boolean;
  setSelectedShift: UseUIStateReturn['setSelectedShift'];
}

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

    recordOperationalTelemetry(
      {
        category: 'daily_record',
        operation: 'app_shell_ready',
        status: 'success',
        context: {
          module: currentModule,
          role: role || 'viewer',
        },
      },
      { allowSuccess: true }
    );
    appShellTelemetryRecordedRef.current = true;
  }, [currentModule, isSignatureMode, role]);
};
