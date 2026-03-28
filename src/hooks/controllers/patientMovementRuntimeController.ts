import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { createScopedLogger } from '@/services/utils/loggerScope';

export interface PatientMovementRuntime {
  alert: (message: string) => void;
  warn?: (message: string) => void;
}

const patientMovementRuntimeLogger = createScopedLogger('PatientMovementRuntime');

export const patientMovementBrowserRuntime: PatientMovementRuntime = {
  alert: (message: string) => {
    defaultBrowserWindowRuntime.alert(message);
  },
  warn: (message: string) => {
    patientMovementRuntimeLogger.warn(message);
  },
};
