import { requestAccessToken } from '@/services/google/googleDriveAuth';
import {
  listDriveFolders,
  uploadToDriveFolder,
  type DriveFolderEntry,
} from '@/services/google/googleDriveFolders';
import {
  createApplicationFailed,
  createApplicationSuccess,
  type ApplicationOutcome,
} from '@/application/shared/applicationOutcome';

const ROOT_FOLDER = 'Hospitalizados';
const DOCUMENT_ROOT_FOLDER = 'Documentos Clinicos';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';

export type ClinicalDocumentDriveFolder = DriveFolderEntry;
export interface ClinicalDocumentDriveUploadResult {
  fileId: string;
  webViewLink: string;
  folderPath: string;
}

const findFolderByName = async (
  token: string,
  folderName: string,
  parentId?: string
): Promise<string | null> => {
  let query = `name='${folderName}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
  if (parentId) {
    query += ` and '${parentId}' in parents`;
  }

  const response = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id,name)`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  return data.files?.[0]?.id || null;
};

const createFolder = async (
  token: string,
  folderName: string,
  parentId?: string
): Promise<string> => {
  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: folderName,
      mimeType: FOLDER_MIME_TYPE,
      parents: parentId ? [parentId] : undefined,
    }),
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error?.message || 'No se pudo crear carpeta en Google Drive.');
  }

  const data = await response.json();
  return data.id as string;
};

const getOrCreateFolder = async (
  token: string,
  folderName: string,
  parentId?: string
): Promise<string> => {
  const existing = await findFolderByName(token, folderName, parentId);
  if (existing) {
    return existing;
  }
  return createFolder(token, folderName, parentId);
};

export const uploadClinicalDocumentPdfToDrive = async (
  blob: Blob,
  fileName: string,
  documentType: string,
  patientName: string,
  patientRut: string,
  episodeKey: string,
  now: Date = new Date(),
  options?: {
    targetFolderId?: string;
    targetFolderPath?: string;
  }
): Promise<ClinicalDocumentDriveUploadResult> => {
  const result = await uploadClinicalDocumentPdfToDriveWithResult(
    blob,
    fileName,
    documentType,
    patientName,
    patientRut,
    episodeKey,
    now,
    options
  );
  if (result.status !== 'success' || !result.data) {
    throw new Error(
      result.issues[0]?.userSafeMessage ||
        result.issues[0]?.message ||
        'No se pudo subir el documento clinico a Google Drive.'
    );
  }
  return result.data;
};

export const uploadClinicalDocumentPdfToDriveWithResult = async (
  blob: Blob,
  fileName: string,
  documentType: string,
  patientName: string,
  patientRut: string,
  episodeKey: string,
  now: Date = new Date(),
  options?: {
    targetFolderId?: string;
    targetFolderPath?: string;
  }
): Promise<ApplicationOutcome<ClinicalDocumentDriveUploadResult | null>> => {
  try {
    const token = await requestAccessToken();
    if (options?.targetFolderId) {
      const upload = await uploadToDriveFolder(token, blob, fileName, options.targetFolderId);
      return createApplicationSuccess({
        ...upload,
        folderPath: options.targetFolderPath || options.targetFolderId,
      });
    }

    const year = now.getFullYear().toString();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const patientFolder = `${patientName.trim().replace(/\s+/g, '_')}_${patientRut.replace(/[.-]/g, '')}_${episodeKey}`;
    const documentFolder = documentType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, letter => letter.toUpperCase());

    const rootId = await getOrCreateFolder(token, ROOT_FOLDER);
    const clinicalId = await getOrCreateFolder(token, DOCUMENT_ROOT_FOLDER, rootId);
    const typeId = await getOrCreateFolder(token, documentFolder, clinicalId);
    const yearId = await getOrCreateFolder(token, year, typeId);
    const monthId = await getOrCreateFolder(token, month, yearId);
    const patientId = await getOrCreateFolder(token, patientFolder, monthId);

    const upload = await uploadToDriveFolder(token, blob, fileName, patientId);
    return createApplicationSuccess({
      ...upload,
      folderPath: `${ROOT_FOLDER}/${DOCUMENT_ROOT_FOLDER}/${documentFolder}/${year}/${month}/${patientFolder}`,
    });
  } catch (error) {
    return createApplicationFailed(null, [
      {
        kind: 'unknown',
        message:
          error instanceof Error
            ? error.message
            : 'No se pudo subir el documento clinico a Google Drive.',
        userSafeMessage:
          error instanceof Error
            ? error.message
            : 'No se pudo subir el documento clinico a Google Drive.',
      },
    ]);
  }
};

export const listClinicalDocumentDriveFolders = async (
  parentId = 'root',
  parentPath = 'Mi unidad'
): Promise<ClinicalDocumentDriveFolder[]> => {
  const result = await listClinicalDocumentDriveFoldersWithResult(parentId, parentPath);
  return result.status === 'success' ? result.data : [];
};

export const listClinicalDocumentDriveFoldersWithResult = async (
  parentId = 'root',
  parentPath = 'Mi unidad'
): Promise<ApplicationOutcome<ClinicalDocumentDriveFolder[]>> => {
  try {
    const token = await requestAccessToken();
    return createApplicationSuccess(await listDriveFolders(token, parentId, parentPath));
  } catch (error) {
    return createApplicationFailed(
      [],
      [
        {
          kind: 'unknown',
          message:
            error instanceof Error
              ? error.message
              : 'No se pudieron cargar carpetas de Google Drive.',
          userSafeMessage: 'No se pudieron cargar carpetas de Google Drive.',
        },
      ]
    );
  }
};
