import type { DeviceDetails, DeviceInstance } from '@/types/domain/clinical';

export interface PatientDeviceCallbacks {
  onDevicesChange: (devices: string[]) => void;
  onDeviceDetailsChange: (details: DeviceDetails) => void;
  onDeviceHistoryChange: (history: DeviceInstance[]) => void;
}
