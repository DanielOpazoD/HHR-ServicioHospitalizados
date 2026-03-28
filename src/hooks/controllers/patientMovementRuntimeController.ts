import { defaultBrowserWindowRuntime } from '@/shared/runtime/browserWindowRuntime';
import { patientMovementRuntimeLogger } from '@/hooks/controllers/hookControllerLoggers';

export interface PatientMovementRuntime {
  alert: (message: string) => void;
  warn?: (message: string) => void;
}

export const patientMovementBrowserRuntime: PatientMovementRuntime = {
  alert: (message: string) => {
    defaultBrowserWindowRuntime.alert(message);
  },
  warn: (message: string) => {
    patientMovementRuntimeLogger.warn(message);
  },
};
