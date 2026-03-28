import type { PatientRowStateContract } from '@/features/census/components/patient-row/patientRowDataContracts';

export interface PatientRowDerivedState {
  isCunaMode: boolean;
  hasCompanion: boolean;
  hasClinicalCrib: boolean;
  isBlocked: boolean;
  isEmpty: boolean;
}

export const derivePatientRowState = (
  data: PatientRowStateContract | null | undefined
): PatientRowDerivedState => ({
  isCunaMode: data?.bedMode === 'Cuna',
  hasCompanion: data?.hasCompanionCrib || false,
  hasClinicalCrib: !!(data?.clinicalCrib && data.clinicalCrib.bedMode),
  isBlocked: data?.isBlocked || false,
  isEmpty: !data?.patientName,
});
