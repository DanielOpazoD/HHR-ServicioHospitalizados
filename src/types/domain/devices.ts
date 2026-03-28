export interface DeviceInstance {
  id: string;
  type: string;
  installationDate: string;
  installationTime?: string;
  removalDate?: string;
  removalTime?: string;
  location?: string;
  status: 'Active' | 'Removed';
  note?: string;
  createdAt: number;
  updatedAt: number;
}

export interface DeviceInfo {
  installationDate?: string;
  removalDate?: string;
  note?: string;
}

export type DeviceDetails = Record<string, DeviceInfo>;

export type DeviceType =
  | 'CVC'
  | 'LA'
  | 'CUP'
  | 'VMNI'
  | 'CNAF'
  | 'TET'
  | 'VVP#1'
  | 'VVP#2'
  | 'VVP#3'
  | string;
