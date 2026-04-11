import { beforeEach, describe, expect, it, vi } from 'vitest';
import { listDriveFolders } from '@/services/google/googleDriveFolders';

describe('googleDriveFolders', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubGlobal('fetch', vi.fn());
  });

  it('maps valid folder list payloads', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [
          { id: 'folder-a', name: 'Documentos' },
          { id: 'folder-b', name: 'Respaldos' },
        ],
      }),
    } as Response);

    const result = await listDriveFolders('token-123', 'root', 'Mi unidad');

    expect(result).toEqual([
      { id: 'folder-a', name: 'Documentos', path: 'Mi unidad/Documentos', parentId: 'root' },
      { id: 'folder-b', name: 'Respaldos', path: 'Mi unidad/Respaldos', parentId: 'root' },
    ]);
  });

  it('rejects malformed folder list payloads', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        files: [{ id: 'folder-a' }],
      }),
    } as Response);

    await expect(listDriveFolders('token-123')).rejects.toThrow();
  });
});
