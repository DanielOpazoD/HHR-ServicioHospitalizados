import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  listClinicalDocumentDriveFolders,
  listClinicalDocumentDriveFoldersWithResult,
  uploadClinicalDocumentPdfToDrive,
  uploadClinicalDocumentPdfToDriveWithResult,
} from '@/features/clinical-documents/services/clinicalDocumentDriveService';

const { mockRequestAccessToken, mockListDriveFolders, mockUploadToDriveFolder, fetchMock } =
  vi.hoisted(() => ({
    mockRequestAccessToken: vi.fn(),
    mockListDriveFolders: vi.fn(),
    mockUploadToDriveFolder: vi.fn(),
    fetchMock: vi.fn(),
  }));

vi.mock('@/services/google/googleDriveAuth', () => ({
  requestAccessToken: mockRequestAccessToken,
}));

vi.mock('@/services/google/googleDriveFolders', () => ({
  listDriveFolders: mockListDriveFolders,
  uploadToDriveFolder: mockUploadToDriveFolder,
}));

describe('clinicalDocumentDriveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestAccessToken.mockResolvedValue('token-123');
    mockUploadToDriveFolder.mockResolvedValue({
      fileId: 'file-1',
      webViewLink: 'https://drive.google.com/file/d/file-1/view',
    });
    mockListDriveFolders.mockResolvedValue([
      { id: 'folder-a', name: 'Documentos', path: 'Mi unidad/Documentos' },
    ]);
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
  });

  it('uploads directly to a preselected Drive folder without resolving hierarchy', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' });

    const result = await uploadClinicalDocumentPdfToDrive(
      blob,
      'Epicrisis.pdf',
      'epicrisis',
      'Paciente Demo',
      '11.111.111-1',
      'episode-1',
      new Date('2026-03-13T10:00:00Z'),
      {
        targetFolderId: 'folder-target',
        targetFolderPath: 'Mi unidad/Hospitalizados/Paciente Demo',
      }
    );

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockUploadToDriveFolder).toHaveBeenCalledWith(
      'token-123',
      blob,
      'Epicrisis.pdf',
      'folder-target'
    );
    expect(result).toEqual({
      fileId: 'file-1',
      webViewLink: 'https://drive.google.com/file/d/file-1/view',
      folderPath: 'Mi unidad/Hospitalizados/Paciente Demo',
    });
  });

  it('creates the full Drive hierarchy when no target folder is provided', async () => {
    fetchMock.mockImplementation(async (_input, init) => {
      const method = init?.method || 'GET';

      if (method === 'GET') {
        return {
          ok: true,
          json: async () => ({ files: [] }),
        } as Response;
      }

      const payload = JSON.parse(String(init?.body || '{}')) as { name?: string };
      return {
        ok: true,
        json: async () => ({ id: `created-${payload.name}` }),
      } as Response;
    });

    const blob = new Blob(['pdf'], { type: 'application/pdf' });
    const now = new Date('2026-03-13T12:30:00Z');

    const result = await uploadClinicalDocumentPdfToDrive(
      blob,
      'Epicrisis.pdf',
      'epicrisis_traslado',
      'Maria Paz Soto',
      '12.345.678-9',
      'episode-42',
      now
    );

    expect(mockUploadToDriveFolder).toHaveBeenCalledWith(
      'token-123',
      blob,
      'Epicrisis.pdf',
      'created-Maria_Paz_Soto_123456789_episode-42'
    );
    expect(result.folderPath).toBe(
      'Hospitalizados/Documentos Clinicos/Epicrisis Traslado/2026/03/Maria_Paz_Soto_123456789_episode-42'
    );
    expect(fetchMock).toHaveBeenCalledTimes(12);
  });

  it('surfaces Google Drive folder creation errors with the remote message', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'Drive quota exceeded' } }),
      } as Response);

    await expect(
      uploadClinicalDocumentPdfToDrive(
        new Blob(['pdf'], { type: 'application/pdf' }),
        'Epicrisis.pdf',
        'epicrisis',
        'Paciente Demo',
        '11.111.111-1',
        'episode-err'
      )
    ).rejects.toThrow('Drive quota exceeded');
  });

  it('lists Drive folders from the requested location', async () => {
    const result = await listClinicalDocumentDriveFolders(
      'folder-root',
      'Mi unidad/Hospitalizados'
    );

    expect(mockListDriveFolders).toHaveBeenCalledWith(
      'token-123',
      'folder-root',
      'Mi unidad/Hospitalizados'
    );
    expect(result).toEqual([{ id: 'folder-a', name: 'Documentos', path: 'Mi unidad/Documentos' }]);
  });

  it('returns a typed failure when Drive upload cannot be completed', async () => {
    mockRequestAccessToken.mockRejectedValueOnce(new Error('auth failed'));

    const result = await uploadClinicalDocumentPdfToDriveWithResult(
      new Blob(['pdf'], { type: 'application/pdf' }),
      'Epicrisis.pdf',
      'epicrisis',
      'Paciente Demo',
      '11.111.111-1',
      'episode-err'
    );

    expect(result.status).toBe('failed');
    expect(result.issues[0]?.message).toContain('auth failed');
  });

  it('returns a typed folder listing failure when Drive list fails', async () => {
    mockListDriveFolders.mockRejectedValueOnce(new Error('drive offline'));

    const result = await listClinicalDocumentDriveFoldersWithResult('root', 'Mi unidad');

    expect(result.status).toBe('failed');
    expect(result.data).toEqual([]);
  });
});
