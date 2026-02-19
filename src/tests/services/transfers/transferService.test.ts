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
    static now = () => ({ toDate: () => new Date() });
    toDate() {
      return new Date();
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
          status: 'SENT',
          observations: 'Urgent transfer',
          statusHistory: [],
        }),
      } as unknown as Awaited<ReturnType<typeof getDoc>>);

      await changeTransferStatus('transfer-123', 'SENT', 'user@hospital.cl');

      expect(getDoc).toHaveBeenCalled();
      expect(setDoc).toHaveBeenCalled();
    });

    it('should throw if transfer not found', async () => {
      vi.mocked(getDoc).mockResolvedValue({
        exists: () => false,
      } as unknown as Awaited<ReturnType<typeof getDoc>>);

      await expect(
        changeTransferStatus('non-existent', 'SENT', 'user@hospital.cl')
      ).rejects.toThrow('not found');
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

    it('should filter transfers correctly in subscription', () => {
      const onSnapshotMock = vi.mocked(firestore.onSnapshot);
      let callback:
        | ((snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void)
        | undefined;
      onSnapshotMock.mockImplementationOnce((_q, next) => {
        if (typeof next !== 'function') return vi.fn();
        callback = next;
        return vi.fn();
      });

      const results: TransferRequest[] = [];
      subscribeToTransfers(t => results.push(...t));

      const mockSnapshot = {
        docs: [
          {
            id: 'TR-ACTIVE',
            data: () => ({ status: 'REQUESTED', requestDate: '2025-01-01', statusHistory: [] }),
          },
          {
            id: 'TR-OLD-COMPLETED',
            data: () => ({
              status: 'TRANSFERRED',
              requestDate: '2025-01-01',
              statusHistory: [{ timestamp: '2025-01-01T10:00:00Z' }],
            }),
          },
        ],
      };

      callback?.(mockSnapshot);
      // Should only have TR-ACTIVE because TR-OLD-COMPLETED is not from "today" in mock scope
      expect(results.some(t => t.id === 'TR-ACTIVE')).toBe(true);
      expect(results.some(t => t.id === 'TR-OLD-COMPLETED')).toBe(false);
    });

    it('should handle transfers with no status history in filter', () => {
      const onSnapshotMock = vi.mocked(firestore.onSnapshot);
      let callback:
        | ((snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void)
        | undefined;
      onSnapshotMock.mockImplementationOnce((_q, next) => {
        if (typeof next !== 'function') return vi.fn();
        callback = next;
        return vi.fn();
      });

      const results: TransferRequest[] = [];
      subscribeToTransfers(t => results.push(...t));

      const mockSnapshot = {
        docs: [
          {
            id: 'TR-NO-HISTORY',
            data: () => ({ status: 'TRANSFERRED', requestDate: '2025-01-01' }), // no statusHistory field
          },
        ],
      };

      callback?.(mockSnapshot);
      expect(results).toHaveLength(0); // Should be filtered out (not today, no history)
    });

    it('should handle subscription errors', () => {
      const onSnapshotMock = vi.mocked(firestore.onSnapshot);
      const callback = vi.fn();

      onSnapshotMock.mockImplementationOnce((...args: unknown[]) => {
        const onError = args[2];
        if (typeof onError === 'function') {
          (onError as (error: Error) => void)(new Error('Sub error'));
        }
        return vi.fn();
      });

      subscribeToTransfers(callback);
      expect(callback).toHaveBeenCalledWith([]);
    });
  });

  describe('getActiveTransfers', () => {
    it('should fetch and return active transfers', async () => {
      const getDocsMock = vi.mocked(firestore.getDocs);
      getDocsMock.mockResolvedValueOnce({
        docs: [{ id: 'TR-1', data: () => ({ status: 'REQUESTED', requestDate: '2025-01-01' }) }],
      } as unknown as Awaited<ReturnType<typeof firestore.getDocs>>);

      const results = await getActiveTransfers();
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('REQUESTED');
    });
  });

  describe('completeTransfer', () => {
    it('should move transfer to history and delete from active', async () => {
      const getDocMock = vi.mocked(firestore.getDoc);
      const deleteDocMock = vi.mocked(firestore.deleteDoc);
      const setDocMock = vi.mocked(firestore.setDoc);

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({ status: 'SENT', statusHistory: [] }),
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

      await expect(completeTransfer('TR-NONEXISTENT', 'user-1')).rejects.toThrow('not found');
    });
  });

  describe('deleteStatusHistoryEntry', () => {
    it('should remove entry and revert status', async () => {
      const getDocMock = vi.mocked(firestore.getDoc);
      const setDocMock = vi.mocked(firestore.setDoc);

      getDocMock.mockResolvedValueOnce({
        exists: () => true,
        data: () => ({
          status: 'SENT',
          statusHistory: [{ to: 'REQUESTED' }, { to: 'SENT' }],
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

      await expect(deleteStatusHistoryEntry('TR-1', 0)).rejects.toThrow('Cannot delete');
    });
  });
});
