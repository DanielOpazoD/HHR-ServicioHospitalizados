import {
  buildMultipartBody,
  createMultipartHeaders,
  parseDriveUploadResult,
  type DriveUploadResult,
} from './googleDriveMultipart';

const DRIVE_FILES_ENDPOINT = 'https://www.googleapis.com/drive/v3/files';
const DRIVE_UPLOAD_ENDPOINT = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const ROOT_TRANSFER_FOLDER = 'Traslados HHR';

export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const;

const authorizedJsonHeaders = (token: string): HeadersInit => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
});

const findFolderByName = async (
  token: string,
  folderName: string,
  parentId?: string
): Promise<string | null> => {
  try {
    let query = `name='${folderName}' and mimeType='${FOLDER_MIME_TYPE}' and trashed=false`;
    if (parentId) {
      query += ` and '${parentId}' in parents`;
    }

    const response = await fetch(
      `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.files?.[0]?.id || null;
  } catch {
    return null;
  }
};

const findFileByName = async (
  token: string,
  fileName: string,
  parentId: string
): Promise<string | null> => {
  try {
    const query = `name='${fileName}' and '${parentId}' in parents and trashed=false`;
    const response = await fetch(
      `${DRIVE_FILES_ENDPOINT}?q=${encodeURIComponent(query)}&fields=files(id,name)`,
      { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!response.ok) return null;

    const data = await response.json();
    return data.files?.[0]?.id || null;
  } catch {
    return null;
  }
};

const createFolder = async (
  token: string,
  folderName: string,
  parentId?: string
): Promise<string> => {
  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: FOLDER_MIME_TYPE,
  };

  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch(DRIVE_FILES_ENDPOINT, {
    method: 'POST',
    headers: authorizedJsonHeaders(token),
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Failed to create folder: ${error.error?.message}`);
  }

  const data = await response.json();
  return data.id;
};

const getOrCreateFolder = async (
  token: string,
  folderName: string,
  parentId?: string
): Promise<string> => {
  const existingId = await findFolderByName(token, folderName, parentId);
  if (existingId) {
    return existingId;
  }
  return createFolder(token, folderName, parentId);
};

const updateFileContent = async (
  token: string,
  fileId: string,
  blob: Blob
): Promise<DriveUploadResult> => {
  const response = await fetch(
    `${DRIVE_UPLOAD_ENDPOINT}/${fileId}?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'PATCH',
      headers: createMultipartHeaders(token),
      body: await buildMultipartBody(blob, {}),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Update failed: ${errorData.error?.message}`);
  }

  return parseDriveUploadResult(response);
};

export const uploadToDriveFolder = async (
  token: string,
  blob: Blob,
  fileName: string,
  folderId: string
): Promise<DriveUploadResult> => {
  const existingFileId = await findFileByName(token, fileName, folderId);
  if (existingFileId) {
    return updateFileContent(token, existingFileId, blob);
  }

  const response = await fetch(
    `${DRIVE_UPLOAD_ENDPOINT}?uploadType=multipart&fields=id,webViewLink`,
    {
      method: 'POST',
      headers: createMultipartHeaders(token),
      body: await buildMultipartBody(blob, {
        name: fileName,
        mimeType: blob.type,
        parents: [folderId],
      }),
    }
  );

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Upload failed: ${errorData.error?.message}`);
  }

  return parseDriveUploadResult(response);
};

const formatPatientFolderName = (patientName: string, patientRut: string): string => {
  const cleanName = patientName.trim().replace(/\s+/g, '_');
  const cleanRut = patientRut.replace(/[.-]/g, '');
  return `${cleanName}_${cleanRut}`;
};

export const ensureTransferFolderHierarchy = async (
  token: string,
  patientName: string,
  patientRut: string,
  now: Date = new Date()
): Promise<{ folderId: string; folderPath: string }> => {
  const year = now.getFullYear().toString();
  const month = MONTHS_ES[now.getMonth()];
  const patientFolder = formatPatientFolderName(patientName, patientRut);

  const rootFolderId = await getOrCreateFolder(token, ROOT_TRANSFER_FOLDER);
  const yearFolderId = await getOrCreateFolder(token, year, rootFolderId);
  const monthFolderId = await getOrCreateFolder(token, month, yearFolderId);
  const patientFolderId = await getOrCreateFolder(token, patientFolder, monthFolderId);

  return {
    folderId: patientFolderId,
    folderPath: `${ROOT_TRANSFER_FOLDER}/${year}/${month}/${patientFolder}`,
  };
};
