import { useCallback, useMemo, useState } from 'react';
import type { DeviceDetails, DeviceInstance } from '@/types/domain/devices';
import type {
  PatientData,
  PatientRowPatientPatch,
} from '@/features/census/components/patient-row/patientRowContracts';
import {
  buildDeviceBundleChangeResult,
  buildDetailsChangeResult,
  buildModalSaveResult,
  buildSelectionChangeResult,
} from '@/features/census/controllers/devicesCellController';
import { DateProvider, systemDateProvider } from '@/features/census/controllers/dateProvider';

interface UseDevicesCellControllerParams {
  data: PatientData;
  onDevicesChange: (devices: string[]) => void;
  onDeviceDetailsChange: (details: DeviceDetails) => void;
  onDeviceHistoryChange: (history: DeviceInstance[]) => void;
  onDeviceBundleChange?: (fields: PatientRowPatientPatch) => void;
  dateProvider?: DateProvider;
}

export const useDevicesCellController = ({
  data,
  onDevicesChange,
  onDeviceDetailsChange,
  onDeviceHistoryChange,
  onDeviceBundleChange,
  dateProvider = systemDateProvider,
}: UseDevicesCellControllerParams) => {
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const devices = useMemo(() => data.devices || [], [data.devices]);
  const deviceDetails = useMemo(() => data.deviceDetails || {}, [data.deviceDetails]);
  const history = useMemo(
    () => (data.deviceInstanceHistory || []) as DeviceInstance[],
    [data.deviceInstanceHistory]
  );

  const openHistory = useCallback(() => setIsHistoryOpen(true), []);
  const closeHistory = useCallback(() => setIsHistoryOpen(false), []);

  const handleDevicesChange = useCallback(
    (nextDevices: string[]) => {
      const result = buildSelectionChangeResult({
        previousDevices: devices,
        nextDevices,
        previousHistory: history,
        deviceDetails,
        dateProvider,
      });

      onDevicesChange(result.nextDevices ?? nextDevices);
      if (result.nextHistory) {
        onDeviceHistoryChange(result.nextHistory);
      }
    },
    [dateProvider, deviceDetails, devices, history, onDeviceHistoryChange, onDevicesChange]
  );

  const handleDeviceDetailsChange = useCallback(
    (nextDetails: DeviceDetails) => {
      const result = buildDetailsChangeResult({
        nextDetails,
        activeDevices: devices,
        previousHistory: history,
        dateProvider,
      });

      onDeviceDetailsChange(result.nextDetails ?? nextDetails);
      if (result.nextHistory) {
        onDeviceHistoryChange(result.nextHistory);
      }
    },
    [dateProvider, devices, history, onDeviceDetailsChange, onDeviceHistoryChange]
  );

  const handleDeviceRetireChange = useCallback(
    (nextDevices: string[], nextDetails: DeviceDetails) => {
      const bundleResult = buildDeviceBundleChangeResult({
        previousDevices: devices,
        nextDevices,
        nextDetails,
        previousHistory: history,
        dateProvider,
      });

      if (onDeviceBundleChange) {
        const fields: PatientRowPatientPatch = {
          devices: bundleResult.nextDevices,
          deviceDetails: bundleResult.nextDetails,
          deviceInstanceHistory: bundleResult.nextHistory,
        };
        onDeviceBundleChange(fields);
        return;
      }

      onDeviceDetailsChange(bundleResult.nextDetails);
      onDevicesChange(bundleResult.nextDevices);
      onDeviceHistoryChange(bundleResult.nextHistory);
    },
    [
      dateProvider,
      devices,
      history,
      onDeviceBundleChange,
      onDeviceDetailsChange,
      onDeviceHistoryChange,
      onDevicesChange,
    ]
  );

  const handleDeviceConfigChange = useCallback(
    (nextDevices: string[] | null, nextDetails: DeviceDetails) => {
      const bundleResult = buildDeviceBundleChangeResult({
        previousDevices: devices,
        nextDevices: nextDevices ?? devices,
        nextDetails,
        previousHistory: history,
        dateProvider,
      });

      if (onDeviceBundleChange) {
        onDeviceBundleChange({
          devices: bundleResult.nextDevices,
          deviceDetails: bundleResult.nextDetails,
          deviceInstanceHistory: bundleResult.nextHistory,
        });
        return;
      }

      onDeviceDetailsChange(bundleResult.nextDetails);
      onDevicesChange(bundleResult.nextDevices);
      onDeviceHistoryChange(bundleResult.nextHistory);
    },
    [
      dateProvider,
      devices,
      history,
      onDeviceBundleChange,
      onDeviceDetailsChange,
      onDeviceHistoryChange,
      onDevicesChange,
    ]
  );

  const handleHistoryModalSave = useCallback(
    (nextHistory: DeviceInstance[]) => {
      const result = buildModalSaveResult(nextHistory);
      onDeviceHistoryChange(result.nextHistory);
      onDevicesChange(result.nextDevices);
    },
    [onDeviceHistoryChange, onDevicesChange]
  );

  return {
    devices,
    deviceDetails,
    history,
    isHistoryOpen,
    openHistory,
    closeHistory,
    handleDevicesChange,
    handleDeviceDetailsChange,
    handleDeviceConfigChange,
    handleDeviceRetireChange,
    handleHistoryModalSave,
  };
};
