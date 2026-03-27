import type { MaybePromiseVoid } from '@/features/census/components/patient-row/patientRowUiContracts';

export const runPatientRowAsyncActionSafely = (action: () => MaybePromiseVoid): void => {
  void Promise.resolve(action()).catch(() => undefined);
};
