/**
 * Google Drive Service
 * Facade over Google Drive auth and structured upload helpers.
 */

export { requestAccessToken } from './googleDriveAuth';
import { requestAccessToken } from './googleDriveAuth';
import { recordOperationalErrorTelemetry } from '@/services/observability/operationalTelemetryOutcomeRecorder';
import {
  buildMultipartBody,
  createMultipartHeaders,
  parseDriveUploadResult,
  type DriveUploadResult,
} from './googleDriveMultipart';
import { ensureTransferFolderHierarchy, uploadToDriveFolder } from './googleDriveFolders';

const extractGoogleDriveErrorMessage = async (response: Response): Promise<string> => {
  try {
    const errorData = await response.json();
    return errorData?.error?.message || response.statusText;
  } catch {
    return response.statusText;
  }
};

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
      const errorMessage = await extractGoogleDriveErrorMessage(response);
      recordOperationalErrorTelemetry('integration', 'google_drive_upload_file', errorMessage, {
        code: 'google_drive_upload_failed',
        message: 'Google Drive upload failed.',
        severity: 'error',
        context: { fileName },
        userSafeMessage: 'No se pudo subir el archivo a Google Drive.',
      });
      throw new Error(`Error en subida a Google Drive: ${errorMessage}`);
    }

    return parseDriveUploadResult(response);
  } catch (error) {
    recordOperationalErrorTelemetry('integration', 'google_drive_upload_to_drive', error, {
      code: 'google_drive_upload_to_drive_failed',
      message: 'Error in uploadToDrive.',
      severity: 'error',
      context: { fileName },
      userSafeMessage: 'No fue posible completar la subida a Google Drive.',
    });
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
      recordOperationalErrorTelemetry(
        'integration',
        'google_drive_make_public_permissions',
        response.statusText,
        {
          code: 'google_drive_permission_request_failed',
          message: 'Google Drive permission request failed.',
          severity: 'warning',
          context: { fileId, status: response.status },
          userSafeMessage: 'No se pudieron aplicar permisos públicos en Google Drive.',
        }
      );
    }
  } catch (error) {
    recordOperationalErrorTelemetry('integration', 'google_drive_make_public_permissions', error, {
      code: 'google_drive_permission_error',
      message: 'Google Drive permission flow failed.',
      severity: 'warning',
      context: { fileId },
      userSafeMessage: 'Se omitió la actualización de permisos de Google Drive.',
    });
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
