import { describe, expect, it, vi } from 'vitest';
import {
  buildDeviceBundleChangeResult,
  buildDetailsChangeResult,
  buildModalSaveResult,
  buildSelectionChangeResult,
} from '@/features/census/controllers/devicesCellController';
import type { DeviceInstance } from '@/types/domain/devices';

describe('devicesCellController', () => {
  it('builds selection result and produces history when a device is removed', () => {
    const previousHistory: DeviceInstance[] = [
      {
        id: 'a1',
        type: 'CVC',
        installationDate: '2026-02-14',
        installationTime: '01:00',
        status: 'Active',
        createdAt: 1,
        updatedAt: 1,
      },
    ];

    const result = buildSelectionChangeResult({
      previousDevices: ['CVC'],
      nextDevices: [],
      previousHistory,
      deviceDetails: {},
      dateProvider: () => new Date('2026-02-15T06:00:00'),
      createId: vi.fn(() => 'x1'),
    });

    expect(result.nextDevices).toEqual([]);
    expect(result.nextHistory).toBeDefined();
    expect(result.nextHistory?.[0].status).toBe('Removed');
  });

  it('builds details result and creates history for active device without active entry', () => {
    const result = buildDetailsChangeResult({
      activeDevices: ['CUP'],
      nextDetails: { CUP: { installationDate: '2026-02-14' } },
      previousHistory: [],
      dateProvider: () => new Date('2026-02-15T06:00:00'),
      createId: vi.fn(() => 'new-id'),
    });

    expect(result.nextDetails).toEqual({ CUP: { installationDate: '2026-02-14' } });
    expect(result.nextHistory).toBeDefined();
    expect(result.nextHistory?.[0].id).toBe('new-id');
    expect(result.nextHistory?.[0].type).toBe('CUP');
    expect(result.nextHistory?.[0].status).toBe('Active');
  });

  it('resolves active device list from modal saved history', () => {
    const history: DeviceInstance[] = [
      {
        id: 'a1',
        type: 'CVC',
        installationDate: '2026-02-14',
        status: 'Active',
        createdAt: 1,
        updatedAt: 1,
      },
      {
        id: 'a2',
        type: 'CUP',
        installationDate: '2026-02-14',
        status: 'Removed',
        createdAt: 2,
        updatedAt: 2,
      },
    ];

    const result = buildModalSaveResult(history);
    expect(result.nextHistory).toEqual(history);
    expect(result.nextDevices).toEqual(['CVC']);
  });

  it('builds one canonical bundle when adding a second simultaneous VVP', () => {
    const result = buildDeviceBundleChangeResult({
      previousDevices: ['VVP#1'],
      nextDevices: ['VVP#1', 'VVP#2'],
      nextDetails: {
        'VVP#1': { installationDate: '2026-02-13' },
        'VVP#2': { installationDate: '2026-02-14' },
      },
      previousHistory: [
        {
          id: 'vvp-1',
          type: 'VVP#1',
          status: 'Active',
          installationDate: '2026-02-13',
          createdAt: 1,
          updatedAt: 1,
        },
      ],
      dateProvider: () => new Date('2026-02-14T08:00:00'),
      createId: vi.fn(() => 'vvp-2'),
    });

    expect(result.nextDevices).toEqual(['VVP#1', 'VVP#2']);
    expect(result.nextDetails).toEqual({
      'VVP#1': { installationDate: '2026-02-13' },
      'VVP#2': { installationDate: '2026-02-14' },
    });
    expect(result.nextHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'vvp-2',
          type: 'VVP#2',
          status: 'Active',
          installationDate: '2026-02-14',
        }),
      ])
    );
  });

  it('compacts remaining VVP after retiring the first simultaneous VVP', () => {
    const result = buildDeviceBundleChangeResult({
      previousDevices: ['VVP#1', 'VVP#2', 'CVC'],
      nextDevices: ['VVP#2', 'CVC'],
      nextDetails: {
        'VVP#1': {
          installationDate: '2026-02-13',
          removalDate: '2026-02-16',
          note: '[Retiro] infiltrada',
        },
        'VVP#2': { installationDate: '2026-02-14' },
        CVC: { installationDate: '2026-02-12' },
      },
      previousHistory: [
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
      dateProvider: () => new Date('2026-02-16T06:00:00'),
      createId: vi.fn(() => 'unused'),
    });

    expect(result.nextDevices).toEqual(['VVP#1', 'CVC']);
    expect(result.nextDetails).toEqual({
      'VVP#1': { installationDate: '2026-02-14' },
      CVC: { installationDate: '2026-02-12' },
    });
    expect(result.nextHistory).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'vvp-1',
          type: 'VVP#1',
          status: 'Removed',
          removalDate: '2026-02-16',
          note: '[Retiro] infiltrada',
        }),
        expect.objectContaining({
          id: 'vvp-2',
          type: 'VVP#1',
          status: 'Active',
          installationDate: '2026-02-14',
        }),
        expect.objectContaining({
          id: 'cvc-1',
          type: 'CVC',
          status: 'Active',
        }),
      ])
    );
  });
});
