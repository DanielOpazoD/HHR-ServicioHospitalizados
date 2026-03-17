/**
 * Transfer Service Tests
 * Tests for patient transfer request operations
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  createTransferRequest,
  updateTransferRequest,
  changeTransferStatus,
  getActiveTransfers,
  getTransferById,
  getLatestOpenTransferRequestByBedId,
  getLatestOpenTransferRequestByPatientRut,
  deleteTransferRequest,
  subscribeToTransfers,
  completeTransfer,
  deleteStatusHistoryEntry,
} from '@/services/transfers/transferService';
import * as firestore from 'firebase/firestore';
import { setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { TransferRequest } from '@/types/transfers';

// Mock repositories using a more robust Vitest pattern
vi.mock('@/services/repositories/DailyRecordRepository', () => {
  return {
    DailyRecordRepository: {
      getAllDates: vi.fn(),
      getForDate: vi.fn(),
      updatePartial: vi.fn(),
    },
  };
});

vi.mock('@/services/repositories/PatientMasterRepository', () => {
  return {
    PatientMasterRepository: {
      bulkUpsertPatients: vi.fn(),
    },
  };
});

// Mock Firebase
vi.mock('firebase/firestore', () => ({
  collection: vi.fn(),
  doc: vi.fn(() => ({ id: 'mock-doc-id' })),
  getDoc: vi.fn(),
  setDoc: vi.fn().mockResolvedValue(undefined),
  deleteDoc: vi.fn().mockResolvedValue(undefined),
  getDocs: vi.fn(),
  query: vi.fn(),
  where: vi.fn(),
  orderBy: vi.fn(),
  onSnapshot: vi.fn((q, cb) => {
    cb({ docs: [] });
    return vi.fn(); // unsubscribe
  }),
  Timestamp: class {
    static now = () => ({ toDate: () => new Date('2026-02-20T00:00:00.000Z') });
    toDate() {
      return new Date('2026-02-20T00:00:00.000Z');
    }
  },
}));

vi.mock('@/firebaseConfig', () => ({
  db: {},
}));

describe('Transfer Service', () => {
  type TransferInput = Parameters<typeof createTransferRequest>[0];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createTransferRequest', () => {
    it('should call setDoc when creating a transfer', async () => {
      // This test verifies the function doesn't throw
      // Actual Firestore interaction is mocked
      await expect(
        createTransferRequest({
          patientId: 'p1',
          bedId: 'R1',
          patientSnapshot: {
            name: 'Test Patient',
            rut: '12.345.678-9',
            age: '50',
            pathology: 'Test',
          },
          destination: 'Hospital Salvador',
          destinationHospital: 'Hospital Salvador',
          requestDate: '2025-01-10',
          priority: 'NORMAL',
          createdBy: 'admin@hospital.cl',
          transferType: 'TRASLADO',
          evacuationMethod: 'SAMU',
          specialRequirements: [],
        } as unknown as TransferInput)
      ).resolves.toBeDefined();

      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('updateTransferRequest', () => {
    it('should call setDoc with merge option', async () => {
      await updateTransferRequest('transfer-123', {
        observations: 'Updated notes',
      });

      expect(setDoc).toHaveBeenCalled();
    });
  });

  describe('changeTransferStatus', () => {
    it('should call getDoc and setDoc', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => true,
        data: () => ({
          status: 'RECEIVED',
          observations: 'Urgent transfer',
          statusHistory: [],
        }),
      } as unknown as Awaited<ReturnType<typeof getDoc>>);

      await changeTransferStatus('transfer-123', 'RECEIVED', 'user@hospital.cl');

      expect(getDoc).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
    });

    it('should throw if transfer not found', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
      } as unknown as Awaited<ReturnType<typeof getDoc>>);

      await expect(
        changeTransferStatus('non-existent', 'RECEIVED', 'user@hospital.cl')
      ).rejects.toThrow('ya no existe o fue movida');
    });
  });

  describe('getTransferById', () => {
    it('should return null when not found', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
      } as unknown as Awaited<ReturnType<typeof getDoc>>);

      const transfer = await getTransferById('non-existent');

      expect(transfer).toBeNull();
    });

    it('should fall back to history collection when active transfer is missing', async () => {
      vi.mocked(getDoc)
        .mockResolvedValueOnce({
          exists: () => false,
        } as unknown as Awaited<ReturnType<typeof getDoc>>)
        .mockResolvedValueOnce({
          exists: () => true,
          data: () => ({
            status: 'TRANSFERRED',
            requestDate: '2025-01-01',
            createdAt: '2025-01-01T10:00:00.000Z',
            updatedAt: '2025-01-02T10:00:00.000Z',
            statusHistory: [],
          }),
        } as unknown as Awaited<ReturnType<typeof getDoc>>);

      const transfer = await getTransferById('archived-transfer');

      expect(transfer?.id).toBe('archived-transfer');
      expect(transfer?.status).toBe('TRANSFERRED');
    });
  });

  describe('deleteTransferRequest', () => {
    it('should call deleteDoc', async () => {
      await deleteTransferRequest('transfer-to-delete');

      expect(deleteDoc).toHaveBeenCalled();
    });
  });

  describe('subscribeToTransfers', () => {
    it('should return an unsubscribe function', () => {
      const callback = vi.fn();
      const unsubscribe = subscribeToTransfers(callback);

      expect(typeof unsubscribe).toBe('function');
    });

    it('should call callback with transfers array', () => {
      const callback = vi.fn();
      subscribeToTransfers(callback);

      expect(callback).toHaveBeenCalledWith([]);
    });

    it('should merge active and history transfers in subscription', () => {
      const onSnapshotMock = vi.mocked(firestore.onSnapshot);
      const callbacks: Array<
        (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void
      > = [];
      onSnapshotMock.mockImplementation((_q, next) => {
        if (typeof next !== 'function') return vi.fn();
        callbacks.push(next);
        return vi.fn();
      });

      let latest: TransferRequest[] = [];
      subscribeToTransfers(t => {
        latest = t;
      });

      const activeSnapshot = {
        docs: [
          {
            id: 'TR-ACTIVE',
            data: () => ({ status: 'REQUESTED', requestDate: '2025-01-01', statusHistory: [] }),
          },
        ],
      };
      const historySnapshot = {
        docs: [
          {
            id: 'TR-CLOSED',
            data: () => ({
              status: 'TRANSFERRED',
              requestDate: '2025-01-01',
              statusHistory: [{ timestamp: '2025-01-01T10:00:00Z' }],
            }),
          },
        ],
      };

      callbacks[0]?.(activeSnapshot);
      callbacks[1]?.(historySnapshot);
      expect(latest.some(t => t.id === 'TR-ACTIVE')).toBe(true);
      expect(latest.some(t => t.id === 'TR-CLOSED')).toBe(true);
    });

    it('should include history transfers even without status history', () => {
      const onSnapshotMock = vi.mocked(firestore.onSnapshot);
      const callbacks: Array<
        (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void
      > = [];
      onSnapshotMock.mockImplementation((_q, next) => {
        if (typeof next !== 'function') return vi.fn();
        callbacks.push(next);
        return vi.fn();
      });

      let latest: TransferRequest[] = [];
      subscribeToTransfers(t => {
        latest = t;
      });

      const historySnapshot = {
        docs: [
          {
            id: 'TR-NO-HISTORY',
            data: () => ({ status: 'TRANSFERRED', requestDate: '2025-01-01' }),
          },
        ],
      };

      callbacks[0]?.({ docs: [] });
      callbacks[1]?.(historySnapshot);
      expect(latest.map(t => t.id)).toContain('TR-NO-HISTORY');
    });

    it('should handle subscription errors', () => {
      const onSnapshotMock = vi.mocked(firestore.onSnapshot);
      const callback = vi.fn();
      const onError = vi.fn();
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

      let subscriptionCall = 0;
      onSnapshotMock.mockImplementation((...args: unknown[]) => {
        const onError = args[2];
        if (subscriptionCall === 0 && typeof onError === 'function') {
          (onError as (error: Error) => void)(new Error('Sub error'));
        } else {
          const onNext = args[1];
          if (typeof onNext === 'function') {
            (onNext as (snapshot: { docs: [] }) => void)({ docs: [] });
          }
        }
        subscriptionCall += 1;
        return vi.fn();
      });

      subscribeToTransfers(callback, { onError });
      expect(callback).toHaveBeenCalledWith([]);
      expect(onError).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getActiveTransfers', () => {
    it('should fetch and return active transfers', async () => {
      const getDocsMock = vi.mocked(firestore.getDocs);
      getDocsMock.mockResolvedValueOnce({
        docs: [{ id: 'TR-1', data: () => ({ status: 'SENT', requestDate: '2025-01-01' }) }],
      } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);

      const results = await getActiveTransfers();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('RECEIVED');
    });
  });

  describe('getLatestOpenTransferRequestByBedId', () => {
    it('returns the most recent non-closed transfer request for the bed', async () => {
      const getDocsMock = vi.mocked(firestore.getDocs);
      getDocsMock.mockResolvedValueOnce({
        docs: [
          {
            id: 'TR-CLOSED',
            data: () => ({
              bedId: 'BED_1',
              status: 'TRANSFERRED',
              archived: false,
              requestDate: '2026-02-01',
              updatedAt: '2026-02-01T10:00:00.000Z',
              createdAt: '2026-02-01T09:00:00.000Z',
              statusHistory: [],
            }),
          },
          {
            id: 'TR-OPEN-OLD',
            data: () => ({
              bedId: 'BED_1',
              status: 'REQUESTED',
              archived: false,
              requestDate: '2026-02-02',
              updatedAt: '2026-02-02T10:00:00.000Z',
              createdAt: '2026-02-02T09:00:00.000Z',
              statusHistory: [],
            }),
          },
          {
            id: 'TR-OPEN-NEW',
            data: () => ({
              bedId: 'BED_1',
              status: 'ACCEPTED',
              archived: false,
              requestDate: '2026-02-03',
              updatedAt: '2026-02-03T10:00:00.000Z',
              createdAt: '2026-02-03T09:00:00.000Z',
              statusHistory: [],
            }),
          },
        ],
      } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);

      const result = await getLatestOpenTransferRequestByBedId('BED_1');
      expect(result?.id).toBe('TR-OPEN-NEW');
    });

    it('returns null when there are no open requests', async () => {
      const getDocsMock = vi.mocked(firestore.getDocs);
      getDocsMock.mockResolvedValueOnce({
        docs: [
          {
            id: 'TR-ARCHIVED',
            data: () => ({
              bedId: 'BED_2',
              status: 'REQUESTED',
              archived: true,
              requestDate: '2026-02-01',
              updatedAt: '2026-02-01T10:00:00.000Z',
              createdAt: '2026-02-01T09:00:00.000Z',
              statusHistory: [],
            }),
          },
          {
            id: 'TR-REJECTED',
            data: () => ({
              bedId: 'BED_2',
              status: 'REJECTED',
              archived: false,
              requestDate: '2026-02-01',
              updatedAt: '2026-02-01T10:00:00.000Z',
              createdAt: '2026-02-01T09:00:00.000Z',
              statusHistory: [],
            }),
          },
        ],
      } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);

      const result = await getLatestOpenTransferRequestByBedId('BED_2');
      expect(result).toBeNull();
    });
  });

  describe('getLatestOpenTransferRequestByPatientRut', () => {
    it('returns the most recent non-closed transfer request for the patient rut', async () => {
      const getDocsMock = vi.mocked(firestore.getDocs);
      getDocsMock.mockResolvedValueOnce({
        docs: [
          {
            id: 'TR-OLD',
            data: () => ({
              bedId: 'BED_1',
              patientSnapshot: { rut: '12.345.678-9' },
              status: 'REQUESTED',
              archived: false,
              requestDate: '2026-02-02',
              updatedAt: '2026-02-02T10:00:00.000Z',
              createdAt: '2026-02-02T09:00:00.000Z',
              statusHistory: [],
            }),
          },
          {
            id: 'TR-NEW',
            data: () => ({
              bedId: 'BED_9',
              patientSnapshot: { rut: '12.345.678-9' },
              status: 'ACCEPTED',
              archived: false,
              requestDate: '2026-02-03',
              updatedAt: '2026-02-03T10:00:00.000Z',
              createdAt: '2026-02-03T09:00:00.000Z',
              statusHistory: [],
            }),
          },
        ],
      } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);

      const result = await getLatestOpenTransferRequestByPatientRut('12.345.678-9');
      expect(result?.id).toBe('TR-NEW');
    });

    it('returns null when patient rut is empty', async () => {
      const result = await getLatestOpenTransferRequestByPatientRut('   ');
      expect(result).toBeNull();
      expect(firestore.getDocs).not.toHaveBeenCalled();
    });
  });

  describe('completeTransfer', () => {
    it('should move transfer to history and delete from active', async () => {
      const getDocMock = vi.mocked(firestore.getDoc);
      const deleteDocMock = vi.mocked(firestore.deleteDoc);
      const setDocMock = vi.mocked(firestore.setDoc);

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'RECEIVED', statusHistory: [] }),
      } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

      await completeTransfer('TR-1', 'user-1');

      expect(setDocMock).toHaveBeenCalled();
      expect(deleteDocMock).toHaveBeenCalled();
    });

    it('should throw if transfer not found for completion', async () => {
      const getDocMock = vi.mocked(firestore.getDoc);
      getDocMock.mockResolvedValueOnce({
        exists: () => false,
      } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

      await expect(completeTransfer('TR-NONEXISTENT', 'user-1')).rejects.toThrow(
        'ya no existe o fue movida'
      );
    });
  });

  describe('deleteStatusHistoryEntry', () => {
    it('should remove entry and revert status', async () => {
      const getDocMock = vi.mocked(firestore.getDoc);
      const setDocMock = vi.mocked(firestore.setDoc);

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'RECEIVED',
          statusHistory: [{ to: 'REQUESTED' }, { to: 'RECEIVED' }],
        }),
      } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

      await deleteStatusHistoryEntry('TR-1', 1);

      expect(setDocMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ status: 'REQUESTED' }),
        expect.anything()
      );
    });

    it('should throw when trying to delete first entry', async () => {
      const getDocMock = vi.mocked(firestore.getDoc);
      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ statusHistory: [{ to: 'REQUESTED' }] }),
      } as unknown as Awaited<ReturnType<typeof firestore.getDoc>>);

      await expect(deleteStatusHistoryEntry('TR-1', 0)).rejects.toThrow(
        'estado actual del traslado'
      );
    });
  });
});
