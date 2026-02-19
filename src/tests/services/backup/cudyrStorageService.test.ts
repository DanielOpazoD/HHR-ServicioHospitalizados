import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  uploadCudyrExcel,
  cudyrExists,
  deleteCudyrFile,
  listCudyrYears,
  listCudyrMonths,
  listCudyrFilesInMonth,
} from '@/services/backup/cudyrStorageService';
import { uploadBytes, getDownloadURL, getMetadata, deleteObject } from 'firebase/storage';

// Mock firebaseConfig to resolve firebaseReady
vi.mock('@/firebaseConfig', () => ({
  storage: {},
  auth: { currentUser: { email: 'test@example.com' } },
  firebaseReady: Promise.resolve(),
}));

// Mock firebase/storage
vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
  getMetadata: vi.fn(),
}));

// Mock baseStorageService helpers
vi.mock('@/services/backup/baseStorageService', () => ({
  MONTH_NAMES: [],
  createListYears: vi.fn(() => vi.fn()),
  createListMonths: vi.fn(() => vi.fn()),
  createListFilesInMonth: vi.fn(() => vi.fn()),
}));

describe('cudyrStorageService', () => {
  const mockDate = '2025-01-01';
  const mockBlob = new Blob(['content']);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('uploadCudyrExcel', () => {
    it('should upload CUDYR and attempt to delete legacy files', async () => {
      vi.mocked(uploadBytes).mockResolvedValue({} as any);
      vi.mocked(getDownloadURL).mockResolvedValue('http://download.url');
      vi.mocked(getMetadata).mockResolvedValue({} as any);

      const url = await uploadCudyrExcel(mockBlob, mockDate);

      expect(url).toBe('http://download.url');
      expect(uploadBytes).toHaveBeenCalled();
    });
  });

  describe('cudyrExists', () => {
    it('should return true if metadata is found', async () => {
      vi.mocked(getMetadata).mockResolvedValue({} as any);

      const exists = await cudyrExists(mockDate);
      expect(exists).toBe(true);
    });

    it('should return false if object not found', async () => {
      vi.mocked(getMetadata).mockRejectedValue({ code: 'storage/object-not-found' });

      const exists = await cudyrExists(mockDate);
      expect(exists).toBe(false);
    });

    it('should return false for unauthorized/unauthenticated lookups', async () => {
      vi.mocked(getMetadata).mockRejectedValue({ code: 'storage/unauthorized' });
      expect(await cudyrExists(mockDate)).toBe(false);

      vi.mocked(getMetadata).mockRejectedValue({ code: 'storage/unauthenticated' });
      expect(await cudyrExists(mockDate)).toBe(false);
    });
  });

  describe('deleteCudyrFile', () => {
    it('swallows expected storage misses', async () => {
      vi.mocked(deleteObject).mockRejectedValue({ code: 'storage/object-not-found' });
      await expect(deleteCudyrFile(mockDate)).resolves.toBeUndefined();
    });

    it('rethrows unexpected errors', async () => {
      vi.mocked(deleteObject).mockRejectedValue(new Error('delete failed'));
      await expect(deleteCudyrFile(mockDate)).rejects.toThrow('delete failed');
    });
  });

  describe('Factory-provided functions', () => {
    it('should exist', () => {
      expect(listCudyrYears).toBeDefined();
      expect(listCudyrMonths).toBeDefined();
      expect(listCudyrFilesInMonth).toBeDefined();
    });
  });
});
