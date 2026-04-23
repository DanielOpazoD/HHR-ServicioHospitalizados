import { beforeEach, describe, expect, it, vi } from 'vitest';

const requestAccessTokenMock = vi.fn();
const buildMultipartBodyMock = vi.fn();
const createMultipartHeadersMock = vi.fn();
const parseDriveUploadResultMock = vi.fn();
const uploadToDriveFolderMock = vi.fn();
const ensureTransferFolderHierarchyMock = vi.fn();
const recordOperationalErrorTelemetryMock = vi.fn();

vi.mock('@/services/google/googleDriveAuth', () => ({
  requestAccessToken: () => requestAccessTokenMock(),
}));

vi.mock('@/services/google/googleDriveMultipart', () => ({
  buildMultipartBody: (...args: unknown[]) => buildMultipartBodyMock(...args),
  createMultipartHeaders: (...args: unknown[]) => createMultipartHeadersMock(...args),
  parseDriveUploadResult: (...args: unknown[]) => parseDriveUploadResultMock(...args),
}));

vi.mock('@/services/google/googleDriveFolders', () => ({
  ensureTransferFolderHierarchy: (...args: unknown[]) => ensureTransferFolderHierarchyMock(...args),
  uploadToDriveFolder: (...args: unknown[]) => uploadToDriveFolderMock(...args),
}));

vi.mock('@/services/observability/operationalTelemetryOutcomeRecorder', () => ({
  recordOperationalErrorTelemetry: (...args: unknown[]) =>
    recordOperationalErrorTelemetryMock(...args),
}));

import {
  makeFilePubliclyEditable,
  uploadToDrive,
  uploadToTransferFolder,
} from '@/services/google/googleDriveService';

describe('googleDriveService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requestAccessTokenMock.mockResolvedValue('token-123');
    buildMultipartBodyMock.mockResolvedValue('multipart-body');
    createMultipartHeadersMock.mockReturnValue({ Authorization: 'Bearer token-123' });
    parseDriveUploadResultMock.mockResolvedValue({
      fileId: 'file-123',
      webViewLink: 'https://drive.google.com/file-123',
    });
    ensureTransferFolderHierarchyMock.mockResolvedValue({
      folderId: 'folder-1',
      folderPath: 'Traslados HHR/2026/Marzo/Paciente',
    });
    uploadToDriveFolderMock.mockResolvedValue({
      fileId: 'file-transfer',
      webViewLink: 'https://drive.google.com/file-transfer',
    });
    vi.stubGlobal('fetch', vi.fn());
  });

  it('uploads to drive and parses a valid upload payload', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'file-123', webViewLink: 'https://drive.google.com/file-123' }),
    } as Response);

    const result = await uploadToDrive(new Blob(['doc'], { type: 'application/pdf' }), 'doc.pdf');

    expect(parseDriveUploadResultMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      fileId: 'file-123',
      webViewLink: 'https://drive.google.com/file-123',
    });
  });

  it('falls back to statusText when a failed upload returns a non-json body', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      statusText: 'Bad Gateway',
      json: async () => {
        throw new Error('not json');
      },
    } as unknown as Response);

    await expect(
      uploadToDrive(new Blob(['doc'], { type: 'application/pdf' }), 'doc.pdf')
    ).rejects.toThrow('Error en subida a Google Drive: Bad Gateway');

    expect(recordOperationalErrorTelemetryMock).toHaveBeenCalled();
  });

  it('does not throw when public-permission update fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    } as Response);

    await expect(makeFilePubliclyEditable('file-123')).resolves.toBeUndefined();
    expect(recordOperationalErrorTelemetryMock).toHaveBeenCalled();
  });

  it('uploads transfer files through the resolved folder hierarchy', async () => {
    const result = await uploadToTransferFolder(
      new Blob(['doc'], { type: 'application/pdf' }),
      'traslado.pdf',
      { patientName: 'Paciente Test', patientRut: '11.111.111-1' }
    );

    expect(ensureTransferFolderHierarchyMock).toHaveBeenCalledWith(
      'token-123',
      'Paciente Test',
      '11.111.111-1'
    );
    expect(uploadToDriveFolderMock).toHaveBeenCalledWith(
      'token-123',
      expect.any(Blob),
      'traslado.pdf',
      'folder-1'
    );
    expect(result.folderPath).toBe('Traslados HHR/2026/Marzo/Paciente');
  });
});
