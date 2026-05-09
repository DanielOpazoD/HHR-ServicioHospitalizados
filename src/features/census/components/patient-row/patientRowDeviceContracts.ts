import type { DeviceDetails, DeviceInstance } from '@/types/domain/devices';
import type { PatientRowPatientPatch } from '@/features/census/components/patient-row/patientRowContracts';

export interface PatientDeviceCallbacks {
  onDevicesChange: (devices: string[]) => void;
  onDeviceDetailsChange: (details: DeviceDetails) => void;
  onDeviceHistoryChange: (history: DeviceInstance[]) => void;
  onDeviceBundleChange?: (fields: PatientRowPatientPatch) => void;
}
