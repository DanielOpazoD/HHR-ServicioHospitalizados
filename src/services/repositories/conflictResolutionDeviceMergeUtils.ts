import { ConflictResolutionTraceContext } from '@/services/repositories/conflictResolutionTrace';

export type DeviceDetailsLike = Record<string, { removalDate?: unknown } | undefined>;

const normalizeDeviceList = (devices: string[] = []): string[] =>
  Array.from(new Set(devices.filter(Boolean).map(String)));

const resolveLocallyRetiredDevices = (
  devices: string[],
  localDeviceDetails: DeviceDetailsLike | undefined
): Set<string> => {
  const retired = new Set<string>();
  devices.forEach(device => {
    const removalDate = localDeviceDetails?.[device]?.removalDate;
    if (String(removalDate || '').trim()) {
      retired.add(device);
    }
  });
  return retired;
};

export const mergePatientDevices = (
  remote: string[] = [],
  local: string[] = [],
  localDeviceDetails: DeviceDetailsLike | undefined,
  preferLocal: boolean,
  traceContext?: ConflictResolutionTraceContext,
  path = '',
  isExplicitlyChangedDeviceList = false
): string[] => {
  const localDevices = normalizeDeviceList(local);

  if (isExplicitlyChangedDeviceList) {
    traceContext?.add({
      path,
      strategy: 'copy_local_value',
      winner: 'local',
      reason: 'explicit_local_active_devices',
    });
    return localDevices;
  }

  const remoteDevices = normalizeDeviceList(remote);
  const retiredDevices = resolveLocallyRetiredDevices(
    [...remoteDevices, ...localDevices],
    localDeviceDetails
  );
  const activeRemoteDevices = remoteDevices.filter(device => !retiredDevices.has(device));
  const activeLocalDevices = localDevices.filter(device => !retiredDevices.has(device));
  const preferred = preferLocal ? activeLocalDevices : activeRemoteDevices;
  const secondary = preferLocal ? activeRemoteDevices : activeLocalDevices;

  traceContext?.add({
    path,
    strategy: 'merge_unique_primitive_array',
    winner: 'merged',
    reason: retiredDevices.size
      ? 'device_union_preserve_local_retire'
      : preferLocal
        ? 'union_prefer_local_order'
        : 'union_prefer_remote_order',
  });

  return Array.from(new Set([...preferred, ...secondary]));
};
