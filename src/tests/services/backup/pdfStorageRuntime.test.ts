import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMetadata, getDownloadURL, deleteObject } from 'firebase/storage';
import { deletePdf, getPdfUrl, pdfExists } from '@/services/backup/pdfStorageService';

vi.mock('@/firebaseConfig', () => ({
  storage: {},
  auth: { currentUser: { email: 'test@example.com' } },
  firebaseReady: Promise.resolve(),
}));

vi.mock('firebase/storage', () => ({
  ref: vi.fn(),
  uploadBytes: vi.fn(),
  getDownloadURL: vi.fn(),
  listAll: vi.fn(),
  deleteObject: vi.fn(),
  getMetadata: vi.fn(),
}));

describe('pdfStorageService runtime resilience', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null url on expected lookup miss errors', async () => {
    vi.mocked(getDownloadURL).mockRejectedValue({ code: 'storage/unauthorized' });
    await expect(getPdfUrl('2026-02-19', 'day')).resolves.toBeNull();
  });

  it('returns false for unauthorized/unauthenticated in exists check', async () => {
    vi.mocked(getMetadata).mockRejectedValue({ code: 'storage/unauthorized' });
    await expect(pdfExists('2026-02-19', 'day')).resolves.toBe(false);

    vi.mocked(getMetadata).mockRejectedValue({ code: 'storage/unauthenticated' });
    await expect(pdfExists('2026-02-19', 'night')).resolves.toBe(false);
  });

  it('delete swallows expected miss errors and rethrows unexpected ones', async () => {
    vi.mocked(deleteObject).mockRejectedValueOnce({ code: 'storage/object-not-found' });
    await expect(deletePdf('2026-02-19', 'day')).resolves.toBeUndefined();

    vi.mocked(deleteObject).mockRejectedValueOnce(new Error('delete failed'));
    await expect(deletePdf('2026-02-19', 'night')).rejects.toThrow('delete failed');
  });
});
