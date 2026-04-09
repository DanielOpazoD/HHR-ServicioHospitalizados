import type { MaybePromiseVoid } from '@/features/census/components/patient-row/patientRowUiContracts';
import { createScopedLogger } from '@/services/utils/loggerScope';

const patientRowActionLogger = createScopedLogger('PatientRowAsyncAction');

export const runPatientRowAsyncActionSafely = (action: () => MaybePromiseVoid): void => {
  void Promise.resolve(action()).catch((error: unknown) => {
    patientRowActionLogger.error('Async patient row action failed silently', error);
  });
};
