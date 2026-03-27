import type { MaybePromiseVoid } from '@/features/census/components/patient-row/patientRowUiContracts';

export interface PatientBedConfigCallbacks {
  onToggleMode: () => MaybePromiseVoid;
  onToggleCompanion: () => MaybePromiseVoid;
  onToggleClinicalCrib: () => void;
  onUpdateClinicalCrib: (action: 'remove') => void;
}
