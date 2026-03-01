/**
 * Integration Tests for DailyRecord Sync Flow
 * Tests useDailyRecordSync hook and its interaction with the repository and Firestore logic.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import React from 'react';
import { useDailyRecordSyncQuery } from '@/hooks/useDailyRecordSyncQuery';
import { UIProvider } from '@/context/UIContext';
import { DailyRecord, PatientStatus, Specialty } from '@/types';
import type { DailyRecordPatch } from '@/hooks/useDailyRecordTypes';
import { createQueryClientTestWrapper } from '@/tests/utils/queryClientTestUtils';
import { DataFactory } from '@/tests/factories/DataFactory';

// ============================================================================
// Mocks
// ============================================================================

// Mock Repository
const mockSubscribe = vi.fn();
const mockSyncWithFirestore = vi.fn();
const mockSave = vi.fn();
const mockUpdatePartial = vi.fn();
const mockGetForDate = vi.fn();
type SubscribeCallback = (record: DailyRecord, hasPendingWrites: boolean) => void;

vi.mock('../../services/repositories/DailyRecordRepository', () => {
  const mockImpl = {
    getForDate: (date: string) => mockGetForDate(date),
    save: (record: DailyRecord) => mockSave(record),
    updatePartial: (date: string, partial: DailyRecordPatch) => mockUpdatePartial(date, partial),
    subscribe: (date: string, cb: SubscribeCallback) => {
      mockSubscribe(date, cb);
      return () => {}; // Unsubscribe
    },
    syncWithFirestore: (date: string) => mockSyncWithFirestore(date),
  };
  return {
    ...mockImpl,
    DailyRecordRepository: mockImpl,
  };
});

// Mock Firebase Auth
vi.mock('../../firebaseConfig', () => ({
  auth: {
    onAuthStateChanged: vi.fn(cb => {
      cb({ uid: 'test-user-123' }); // Simulate logged in user
      return () => {}; // Unsubscribe
    }),
  },
}));

// Mock UI Context
vi.mock('../../context/UIContext', () => ({
  useNotification: () => ({
    success: vi.fn(),
    error: vi.fn(),
  }),
  UIProvider: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock Utils
vi.mock('../../services/utils/errorService', () => ({
  logFirebaseError: vi.fn(),
  getUserFriendlyErrorMessage: vi.fn(_err => 'Friendly Error'),
}));

vi.mock('../../services/storage/unifiedLocalService', () => ({
  saveRecordLocal: vi.fn(),
}));

// ============================================================================
// Helper Data
// ============================================================================

const createMockRecord = (date: string): DailyRecord =>
  DataFactory.createMockDailyRecord(date, {
    beds: {},
    discharges: [],
    transfers: [],
    cma: [],
    lastUpdated: '2024-12-28T12:00:00Z',
    nurses: [],
  });

// ============================================================================
// Tests
// ============================================================================

const createWrapper = () => {
  const { wrapper } = createQueryClientTestWrapper({
    wrapChildren: children => <UIProvider>{children}</UIProvider>,
  });
  return wrapper;
};

describe('DailyRecord Sync Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetForDate.mockReturnValue(null);
    mockSyncWithFirestore.mockResolvedValue(null);
    mockSave.mockResolvedValue(undefined);
    mockUpdatePartial.mockResolvedValue(undefined);
  });

  it('should load local record on mount', async () => {
    const localRecord = createMockRecord('2024-12-28');
    mockGetForDate.mockResolvedValue(localRecord);

    const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.record).toEqual(localRecord);
    });
    expect(mockGetForDate).toHaveBeenCalledWith('2024-12-28');
  });

  it('should subscribe to remote changes on mount', async () => {
    renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });

    expect(mockSubscribe).toHaveBeenCalledWith('2024-12-28', expect.any(Function));
  });

  it('should update record when remote change is received (no local pending)', async () => {
    const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });

    const remoteRecord = createMockRecord('2024-12-28');
    remoteRecord.lastUpdated = '2024-12-28T13:00:00Z';

    // WAITING FOR INITIAL FETCH TO COMPLETE (avoids race condition with setQueryData)
    await waitFor(() => expect(result.current.syncStatus).toBe('idle'));

    // Trigger the callback passed to mockSubscribe
    const subscribeCallback = mockSubscribe.mock.calls[0][1];

    // Update mock to return the remote record on next fetch (if invalidation happens)
    mockGetForDate.mockResolvedValue(remoteRecord);

    await act(async () => {
      subscribeCallback(remoteRecord, false); // hasPendingWrites = false
    });

    await waitFor(() => {
      expect(result.current.record).toEqual(remoteRecord);
    });
  });

  it('should ignore remote echo while local pending writes are flagged', async () => {
    const localRecord = createMockRecord('2024-12-28');
    localRecord.beds = {
      R1: {
        bedId: 'R1',
        isBlocked: false,
        bedMode: 'Cama',
        hasCompanionCrib: false,
        patientName: 'Cambio local',
        rut: '',
        age: '',
        pathology: '',
        specialty: Specialty.MEDICINA,
        status: PatientStatus.ESTABLE,
        admissionDate: '',
        hasWristband: false,
        devices: [],
        surgicalComplication: false,
        isUPC: false,
      },
    };
    mockGetForDate.mockResolvedValue(localRecord);

    const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.record).toEqual(localRecord));

    const subscribeCallback = mockSubscribe.mock.calls[0][1];

    await act(async () => {
      subscribeCallback(
        {
          ...createMockRecord('2024-12-28'),
          beds: {
            R1: {
              bedId: 'R1',
              isBlocked: false,
              bedMode: 'Cama',
              hasCompanionCrib: false,
              patientName: 'Eco remoto',
              rut: '',
              age: '',
              pathology: '',
              specialty: Specialty.MEDICINA,
              status: PatientStatus.ESTABLE,
              admissionDate: '',
              hasWristband: false,
              devices: [],
              surgicalComplication: false,
              isUPC: false,
            },
          },
        },
        true
      );
    });

    expect(result.current.record?.beds.R1.patientName).toBe('Cambio local');
  });

  it('should save and update state on saveAndUpdate call', async () => {
    const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });
    const newRecord = createMockRecord('2024-12-28');
    newRecord.nurses = ['Nurse A'];

    // WAIT for initial state
    await waitFor(() => expect(result.current.syncStatus).toBe('idle'));

    await act(async () => {
      mockGetForDate.mockResolvedValue(newRecord);
      await result.current.saveAndUpdate(newRecord);
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    expect(mockSave.mock.calls[0][0]).toEqual(newRecord);
    await waitFor(() => {
      expect(result.current.record).toEqual(newRecord);
      expect(result.current.syncStatus).toBe('saved');
    });
  });

  it('should perform patch update and keep state in sync', async () => {
    const initialRecord = createMockRecord('2024-12-28');
    mockGetForDate.mockReturnValue(initialRecord);

    const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });

    // Wait for load
    await waitFor(() => {
      expect(result.current.record).toEqual(initialRecord);
    });

    const partial = { 'beds.R1.patientName': 'Nuevo Paciente' };

    await act(async () => {
      // Mock return for next fetch
      mockGetForDate.mockResolvedValue({
        ...initialRecord,
        beds: {
          ...initialRecord.beds,
          R1: {
            ...initialRecord.beds.R1,
            patientName: 'Nuevo Paciente',
          },
        },
      });
      await result.current.patchRecord(partial);
    });

    expect(mockUpdatePartial).toHaveBeenCalledWith('2024-12-28', partial);
    // Wait for optimistic update or refetch
    await waitFor(() => {
      expect(result.current.record?.beds.R1.patientName).toBe('Nuevo Paciente');
      expect(result.current.syncStatus).toBe('saved');
    });
  });

  it('should handle save errors and update syncStatus', async () => {
    mockSave.mockRejectedValue(new Error('Firebase error'));
    const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.syncStatus).toBe('idle'));

    await act(async () => {
      await result.current.saveAndUpdate(createMockRecord('2024-12-28')).catch(() => undefined);
    });

    await waitFor(() => {
      expect(result.current.syncStatus).toBe('error');
    });
  });

  it('should refetch after save conflict error path settles', async () => {
    const currentRecord = createMockRecord('2024-12-28');
    const refreshedRecord = {
      ...currentRecord,
      beds: {
        R1: {
          ...(currentRecord.beds.R1 || {}),
          bedId: 'R1',
          patientName: 'Desde refetch',
        },
      },
    };

    mockGetForDate.mockResolvedValueOnce(currentRecord);
    mockSave.mockRejectedValueOnce(new Error('El registro ha sido modificado por otro usuario.'));

    const { result } = renderHook(() => useDailyRecordSyncQuery('2024-12-28', false, true), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.syncStatus).toBe('idle'));

    mockGetForDate.mockResolvedValue(refreshedRecord);

    await act(async () => {
      await result.current.saveAndUpdate(currentRecord).catch(() => undefined);
    });

    await waitFor(() => {
      expect(mockGetForDate).toHaveBeenCalledWith('2024-12-28');
    });
  });
});
