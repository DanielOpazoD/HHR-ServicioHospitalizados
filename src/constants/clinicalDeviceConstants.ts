export const VVP_DEVICE_KEYS = ['VVP#1', 'VVP#2', 'VVP#3'] as const;
export const DEVICE_OPTIONS: string[] = ['CVC', 'LA', 'CUP', 'TET', 'SNG'];
export type DeviceType = (typeof DEVICE_OPTIONS)[number] | (typeof VVP_DEVICE_KEYS)[number];
