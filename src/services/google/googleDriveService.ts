/**
 * Google Drive Service
 * Facade over Google Drive auth and structured upload helpers.
 */

export { requestAccessToken } from './googleDriveAuth';
import { requestAccessToken } from './googleDriveAuth';
import {
  buildMultipartBody,
  createMultipartHeaders,
  parseDriveUploadResult,
  type DriveUploadResult,
} from './googleDriveMultipart';
import { ensureTransferFolderHierarchy, uploadToDriveFolder } from './googleDriveFolders';

/**
 * Uploads a Blob to Google Drive and returns the file ID and editing link.
 *
 * @param blob The file content (DOCX or XLSX)
 * @param fileName The name for the file in Drive
 * @returns Object with fileId and webViewLink
 */
export const uploadToDrive = async (blob: Blob, fileName: string): Promise<DriveUploadResult> => {
  try {
    const token = await requestAccessToken();
    const response = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink',
      {
        method: 'POST',
        headers: createMultipartHeaders(token),
        body: await buildMultipartBody(blob, {
          name: fileName,
          mimeType: blob.type,
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      console.error('[GoogleDrive] Upload failed:', errorData);
      throw new Error(
        `Error en subida a Google Drive: ${errorData.error?.message || response.statusText}`
      );
    }

    return parseDriveUploadResult(response);
  } catch (error) {
    console.error('[GoogleDrive] Error in uploadToDrive:', error);
    throw error;
  }
};

/**
 * Makes the file editable by anyone with the link (optional utility)
 */
export const makeFilePubliclyEditable = async (fileId: string): Promise<void> => {
  try {
    const token = await requestAccessToken();

    const response = await fetch(
      `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          role: 'writer',
          type: 'anyone',
        }),
      }
    );

    if (!response.ok) {
      console.warn('[GoogleDrive] Could not set public permissions');
    }
  } catch (error) {
    console.warn('[GoogleDrive] Permission error skipped:', error);
  }
};

export interface TransferUploadOptions {
  patientName: string;
  patientRut: string;
}

/**
 * Uploads a file to the organized transfer folder structure:
 * Traslados HHR / Año / Mes / Nombre_Apellido_RUT
 */
export const uploadToTransferFolder = async (
  blob: Blob,
  fileName: string,
  options: TransferUploadOptions
): Promise<{ fileId: string; webViewLink: string; folderPath: string }> => {
  const token = await requestAccessToken();
  const { folderId, folderPath } = await ensureTransferFolderHierarchy(
    token,
    options.patientName,
    options.patientRut
  );
  const result = await uploadToDriveFolder(token, blob, fileName, folderId);

  return {
    ...result,
    folderPath,
  };
};
