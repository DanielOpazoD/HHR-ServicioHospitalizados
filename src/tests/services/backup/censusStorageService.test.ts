import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadCensus,
  checkCensusExists,
  deleteCensusFile,
  listCensusYears,
  listCensusMonths,
  listCensusFilesInMonth,
} from '@/services/backup/censusStorageService';
import { ref, uploadBytes, getDownloadURL, listAll, deleteObject } from 'firebase/storage';

// Mock firebase/storage
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
}));

// Mock baseStorageService helpers
vi.mock('@/services/backup/baseStorageService', () => ({
  MONTH_NAMES: [],
  createListYears: vi.fn(() => vi.fn()),
  createListMonths: vi.fn(() => vi.fn()),
  createListFilesInMonth: vi.fn(() => vi.fn()),
}));

describe('censusStorageService', () => {
  const mockDate = '2025-01-01';
  const mockBlob = new Blob(['content'], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadCensus', () => {
    it('should upload census and return download URL', async () => {
      vi.mocked(uploadBytes).mockResolvedValue({} as any);
      vi.mocked(getDownloadURL).mockResolvedValue('http://download.url');

      const url = await uploadCensus(mockBlob, mockDate);

      expect(ref).toHaveBeenCalled();
      expect(uploadBytes).toHaveBeenCalled();
      expect(getDownloadURL).toHaveBeenCalled();
      expect(url).toBe('http://download.url');
    });
  });

  describe('checkCensusExists', () => {
    it('should return true if file exists', async () => {
      vi.mocked(listAll).mockResolvedValue({
        items: [{ name: '01-01-2025 - Censo Diario.xlsx' }],
      } as any);
      const exists = await checkCensusExists(mockDate);
      expect(exists).toBe(true);
    });

    it('should return false if file not found', async () => {
      vi.mocked(listAll).mockResolvedValue({
        items: [{ name: '31-12-2024 - Censo Diario.xlsx' }],
      } as any);
      const exists = await checkCensusExists(mockDate);
      expect(exists).toBe(false);
    });

    it('should return false when Storage returns not-found errors', async () => {
      vi.mocked(listAll).mockRejectedValue({ code: 'storage/object-not-found' });

      const exists = await checkCensusExists(mockDate);

      expect(exists).toBe(false);
    });

    it('should return false when Storage returns unauthorized/unauthenticated', async () => {
      vi.mocked(listAll).mockRejectedValue({ code: 'storage/unauthorized' });
      const unauthorizedExists = await checkCensusExists(mockDate);
      expect(unauthorizedExists).toBe(false);

      vi.mocked(listAll).mockRejectedValue({ code: 'storage/unauthenticated' });
      const unauthenticatedExists = await checkCensusExists(mockDate);
      expect(unauthenticatedExists).toBe(false);
    });

    it('should return false for unexpected errors', async () => {
      vi.mocked(listAll).mockRejectedValue(new Error('Other Error'));

      const exists = await checkCensusExists(mockDate);

      expect(exists).toBe(false);
    });
  });

  describe('deleteCensusFile', () => {
    it('should call deleteObject', async () => {
      vi.mocked(deleteObject).mockResolvedValue(undefined as any);
      await deleteCensusFile(mockDate);
      expect(deleteObject).toHaveBeenCalled();
    });

    it('should swallow expected miss errors during delete', async () => {
      vi.mocked(deleteObject).mockRejectedValue({ code: 'storage/object-not-found' });
      await expect(deleteCensusFile(mockDate)).resolves.toBeUndefined();

      vi.mocked(deleteObject).mockRejectedValue({ code: 'storage/unauthorized' });
      await expect(deleteCensusFile(mockDate)).resolves.toBeUndefined();
    });

    it('should rethrow unexpected delete errors', async () => {
      vi.mocked(deleteObject).mockRejectedValue(new Error('delete failed'));
      await expect(deleteCensusFile(mockDate)).rejects.toThrow('delete failed');
    });
  });

  describe('Factory-provided functions', () => {
    it('should exist', () => {
      expect(listCensusYears).toBeDefined();
      expect(listCensusMonths).toBeDefined();
      expect(listCensusFilesInMonth).toBeDefined();
    });
  });
});
