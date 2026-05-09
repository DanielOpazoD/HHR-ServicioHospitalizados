import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useDevicesCellController } from '@/features/census/components/patient-row/useDevicesCellController';
import type { DeviceInstance } from '@/types/domain/devices';
import type { PatientData } from '@/types/domain/patient';

const buildData = (overrides: Partial<PatientData> = {}): PatientData =>
  ({
    patientName: 'Paciente',
    devices: ['CVC'],
    deviceDetails: {},
    deviceInstanceHistory: [],
    ...overrides,
  }) as PatientData;

describe('useDevicesCellController', () => {
  it('toggles history modal state', () => {
    const { result } = renderHook(() =>
      useDevicesCellController({
        data: buildData(),
        onDevicesChange: vi.fn(),
        onDeviceDetailsChange: vi.fn(),
        onDeviceHistoryChange: vi.fn(),
      })
    );

    expect(result.current.isHistoryOpen).toBe(false);
    act(() => result.current.openHistory());
    expect(result.current.isHistoryOpen).toBe(true);
    act(() => result.current.closeHistory());
    expect(result.current.isHistoryOpen).toBe(false);
  });

  it('emits devices update and history sync on selection changes', () => {
    const onDevicesChange = vi.fn();
    const onDeviceDetailsChange = vi.fn();
    const onDeviceHistoryChange = vi.fn();

    const { result } = renderHook(() =>
      useDevicesCellController({
        data: buildData(),
        onDevicesChange,
        onDeviceDetailsChange,
        onDeviceHistoryChange,
        dateProvider: () => new Date('2026-02-15T06:00:00'),
      })
    );

    act(() => result.current.handleDevicesChange([]));

    expect(onDevicesChange).toHaveBeenCalledWith([]);
    expect(onDeviceHistoryChange).toHaveBeenCalledTimes(1);
    const historyPayload = onDeviceHistoryChange.mock.calls[0][0];
    expect(historyPayload[0].removalDate).toBe('2026-02-15');
    expect(onDeviceDetailsChange).not.toHaveBeenCalled();
  });

  it('bundles generic invasive-device retirement into one atomic patient patch', () => {
    const onDevicesChange = vi.fn();
    const onDeviceDetailsChange = vi.fn();
    const onDeviceHistoryChange = vi.fn();
    const onDeviceBundleChange = vi.fn();

    const { result } = renderHook(() =>
      useDevicesCellController({
        data: buildData({
          devices: ['TET', 'CVC', 'SNG'],
          deviceDetails: {
            TET: { installationDate: '2026-02-13' },
            CVC: { installationDate: '2026-02-14' },
            SNG: { installationDate: '2026-02-15' },
          },
        }),
        onDevicesChange,
        onDeviceDetailsChange,
        onDeviceHistoryChange,
        onDeviceBundleChange,
        dateProvider: () => new Date('2026-02-16T06:00:00'),
      })
    );

    act(() =>
      result.current.handleDeviceRetireChange(['CVC', 'SNG'], {
        TET: {
          installationDate: '2026-02-13',
          removalDate: '2026-02-16',
          note: '[Retiro] extubado',
        },
        CVC: { installationDate: '2026-02-14' },
        SNG: { installationDate: '2026-02-15' },
      })
    );

    expect(onDeviceBundleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        devices: ['CVC', 'SNG'],
        deviceDetails: expect.objectContaining({
          TET: expect.objectContaining({
            removalDate: '2026-02-16',
          }),
          CVC: expect.objectContaining({
            installationDate: '2026-02-14',
          }),
          SNG: expect.objectContaining({
            installationDate: '2026-02-15',
          }),
        }),
        deviceInstanceHistory: expect.arrayContaining([
          expect.objectContaining({
            type: 'TET',
            status: 'Removed',
            removalDate: '2026-02-16',
          }),
        ]),
      })
    );
    expect(onDevicesChange).not.toHaveBeenCalled();
    expect(onDeviceDetailsChange).not.toHaveBeenCalled();
    expect(onDeviceHistoryChange).not.toHaveBeenCalled();
  });

  it('retires one VVP while preserving the other active VVP and non-VVP devices', () => {
    const onDevicesChange = vi.fn();
    const onDeviceDetailsChange = vi.fn();
    const onDeviceHistoryChange = vi.fn();
    const onDeviceBundleChange = vi.fn();

    const { result } = renderHook(() =>
      useDevicesCellController({
        data: buildData({
          devices: ['VVP#1', 'VVP#2', 'CVC'],
          deviceDetails: {
            'VVP#1': { installationDate: '2026-02-13' },
            'VVP#2': { installationDate: '2026-02-14' },
            CVC: { installationDate: '2026-02-12' },
          },
          deviceInstanceHistory: [
            {
              id: 'vvp-1',
              type: 'VVP#1',
              status: 'Active',
              installationDate: '2026-02-13',
              createdAt: 1,
              updatedAt: 1,
            },
            {
              id: 'vvp-2',
              type: 'VVP#2',
              status: 'Active',
              installationDate: '2026-02-14',
              createdAt: 2,
              updatedAt: 2,
            },
            {
              id: 'cvc-1',
              type: 'CVC',
              status: 'Active',
              installationDate: '2026-02-12',
              createdAt: 3,
              updatedAt: 3,
            },
          ],
        }),
        onDevicesChange,
        onDeviceDetailsChange,
        onDeviceHistoryChange,
        onDeviceBundleChange,
        dateProvider: () => new Date('2026-02-16T06:00:00'),
      })
    );

    act(() =>
      result.current.handleDeviceRetireChange(['VVP#2', 'CVC'], {
        'VVP#1': {
          installationDate: '2026-02-13',
          removalDate: '2026-02-16',
          note: '[Retiro] infiltrada',
        },
        'VVP#2': { installationDate: '2026-02-14' },
        CVC: { installationDate: '2026-02-12' },
      })
    );

    expect(onDeviceBundleChange).toHaveBeenCalledWith(
      expect.objectContaining({
        devices: ['VVP#2', 'CVC'],
        deviceDetails: expect.objectContaining({
          'VVP#1': expect.objectContaining({
            removalDate: '2026-02-16',
          }),
          'VVP#2': expect.objectContaining({
            installationDate: '2026-02-14',
          }),
          CVC: expect.objectContaining({
            installationDate: '2026-02-12',
          }),
        }),
        deviceInstanceHistory: expect.arrayContaining([
          expect.objectContaining({
            type: 'VVP#1',
            status: 'Removed',
            removalDate: '2026-02-16',
          }),
          expect.objectContaining({
            type: 'VVP#2',
            status: 'Active',
          }),
          expect.objectContaining({
            type: 'CVC',
            status: 'Active',
          }),
        ]),
      })
    );
    expect(onDevicesChange).not.toHaveBeenCalled();
    expect(onDeviceDetailsChange).not.toHaveBeenCalled();
    expect(onDeviceHistoryChange).not.toHaveBeenCalled();
  });

  it('maps modal save into history + active devices updates', () => {
    const onDevicesChange = vi.fn();
    const onDeviceDetailsChange = vi.fn();
    const onDeviceHistoryChange = vi.fn();

    const { result } = renderHook(() =>
      useDevicesCellController({
        data: buildData(),
        onDevicesChange,
        onDeviceDetailsChange,
        onDeviceHistoryChange,
      })
    );

    const savedHistory: DeviceInstance[] = [
      {
        id: 'x1',
        type: 'CVC',
        installationDate: '2026-02-14',
        status: 'Active',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    act(() => result.current.handleHistoryModalSave(savedHistory));

    expect(onDeviceHistoryChange).toHaveBeenCalledWith(savedHistory);
    expect(onDevicesChange).toHaveBeenCalledWith(['CVC']);
  });
});
