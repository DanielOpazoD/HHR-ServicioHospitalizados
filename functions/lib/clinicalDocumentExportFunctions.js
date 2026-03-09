const functions = require('firebase-functions/v1');
const { google } = require('googleapis');
const { Readable } = require('stream');
const { HOSPITAL_ID } = require('./runtime/runtimeConfig');

const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive';
const FOLDER_MIME_TYPE = 'application/vnd.google-apps.folder';
const EXPORT_ALLOWED_ROLES = new Set(['admin', 'doctor_urgency']);
const SPANISH_MONTH_NAMES = [
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
];

const normalizeText = value =>
  String(value || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

const sanitizePathSegment = (value, fallback = 'SinDato') => {
  const normalized = normalizeText(value)
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, ' ');
  return normalized.length > 0 ? normalized : fallback;
};

const assertString = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Missing required field: ${fieldName}`
    );
  }
  return value.trim();
};

const resolveCallerRole = async (context, resolveRoleForEmail) => {
  const claimRole = context?.auth?.token?.role;
  if (claimRole && typeof claimRole === 'string') {
    return claimRole;
  }

  const callerEmail = normalizeText(context?.auth?.token?.email).toLowerCase();
  if (!callerEmail) return 'unauthorized';
  return resolveRoleForEmail(callerEmail);
};

const assertExportAccess = async (context, resolveRoleForEmail) => {
  if (!context?.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be authenticated.');
  }

  const role = await resolveCallerRole(context, resolveRoleForEmail);
  if (!EXPORT_ALLOWED_ROLES.has(role)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Insufficient permissions to export clinical documents to Drive.'
    );
  }
};

const decodeBase64Payload = payload => {
  const normalized = assertString(payload, 'contentBase64').replace(/\s+/g, '');
  const buffer = Buffer.from(normalized, 'base64');
  if (!buffer || buffer.length === 0) {
    throw new functions.https.HttpsError('invalid-argument', 'Invalid contentBase64 payload.');
  }
  return buffer;
};

const buildDriveMonthFolderName = date => {
  const monthName = SPANISH_MONTH_NAMES[date.getMonth()] || 'Mes';
  return `${monthName} ${date.getFullYear()}`;
};

const buildDriveClient = () => {
  const auth = new google.auth.GoogleAuth({ scopes: [DRIVE_SCOPE] });
  return google.drive({ version: 'v3', auth });
};

const findFolderByName = async (drive, folderName, parentId) => {
  const query = [
    `name='${folderName.replace(/'/g, "\\'")}'`,
    `mimeType='${FOLDER_MIME_TYPE}'`,
    'trashed=false',
    `'${parentId}' in parents`,
  ].join(' and ');

  const response = await drive.files.list({
    q: query,
    pageSize: 1,
    fields: 'files(id,name)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files?.[0]?.id || null;
};

const createFolder = async (drive, folderName, parentId) => {
  const response = await drive.files.create({
    requestBody: {
      name: folderName,
      mimeType: FOLDER_MIME_TYPE,
      parents: [parentId],
    },
    fields: 'id,name',
    supportsAllDrives: true,
  });

  return response.data.id;
};

const getOrCreateFolder = async (drive, folderName, parentId) => {
  const existingId = await findFolderByName(drive, folderName, parentId);
  if (existingId) {
    return existingId;
  }
  return createFolder(drive, folderName, parentId);
};

const findFileByName = async (drive, fileName, parentId) => {
  const query = [
    `name='${fileName.replace(/'/g, "\\'")}'`,
    `'${parentId}' in parents`,
    'trashed=false',
  ].join(' and ');

  const response = await drive.files.list({
    q: query,
    pageSize: 1,
    fields: 'files(id,name,webViewLink)',
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  return response.data.files?.[0] || null;
};

const upsertPdfFile = async (drive, folderId, fileName, mimeType, bodyBuffer) => {
  const toMediaBody = () => Readable.from(bodyBuffer);
  const existing = await findFileByName(drive, fileName, folderId);
  if (existing?.id) {
    const updated = await drive.files.update({
      fileId: existing.id,
      media: {
        mimeType,
        body: toMediaBody(),
      },
      fields: 'id,webViewLink',
      supportsAllDrives: true,
    });
    return {
      id: updated.data.id,
      webViewLink: updated.data.webViewLink || '',
    };
  }

  const created = await drive.files.create({
    requestBody: {
      name: fileName,
      mimeType,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: toMediaBody(),
    },
    fields: 'id,webViewLink',
    supportsAllDrives: true,
  });

  return {
    id: created.data.id,
    webViewLink: created.data.webViewLink || '',
  };
};

const writeAuditEntry = async ({
  admin,
  documentId,
  documentType,
  patientRut,
  episodeKey,
  caller,
}) => {
  if (!documentId) return;

  const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  await admin
    .firestore()
    .collection('hospitals')
    .doc(HOSPITAL_ID)
    .collection('auditLogs')
    .doc(auditId)
    .set({
      id: auditId,
      timestamp: new Date().toISOString(),
      userId: caller?.uid || null,
      userUid: caller?.uid || null,
      userDisplayName: caller?.name || caller?.email || 'Usuario',
      action: 'CLINICAL_DOCUMENT_DRIVE_EXPORTED',
      entityType: 'clinicalDocument',
      entityId: documentId,
      summary: `Exportó ${documentType} a Drive`,
      details: {
        documentId,
        documentType,
        patientRut,
        episodeKey,
        source: 'callable_backend',
      },
      recordDate: null,
    });
};

const createClinicalDocumentExportFunctions = ({
  admin,
  resolveRoleForEmail,
  buildDriveClientOverride,
}) => ({
  exportClinicalDocumentPdfToDrive: functions.https.onCall(async (data, context) => {
    await assertExportAccess(context, resolveRoleForEmail);

    const rootFolderId = process.env.CLINICAL_DRIVE_ROOT_FOLDER_ID;
    if (!rootFolderId) {
      throw new functions.https.HttpsError(
        'failed-precondition',
        'CLINICAL_DRIVE_ROOT_FOLDER_ID is not configured.'
      );
    }

    const fileName = assertString(data?.fileName, 'fileName');
    const documentType = assertString(data?.documentType, 'documentType');
    const patientName = assertString(data?.patientName, 'patientName');
    const patientRut = assertString(data?.patientRut, 'patientRut');
    const episodeKey = assertString(data?.episodeKey, 'episodeKey');
    const mimeType = typeof data?.mimeType === 'string' ? data.mimeType : 'application/pdf';
    const content = decodeBase64Payload(data?.contentBase64);

    const now = new Date();
    const year = now.getFullYear().toString();
    const monthFolderName = buildDriveMonthFolderName(now);
    const drive = buildDriveClientOverride ? buildDriveClientOverride() : buildDriveClient();
    const yearFolderId = await getOrCreateFolder(drive, year, rootFolderId);
    const monthFolderId = await getOrCreateFolder(drive, monthFolderName, yearFolderId);

    const upload = await upsertPdfFile(drive, monthFolderId, fileName, mimeType, content);
    await writeAuditEntry({
      admin,
      documentId: typeof data?.documentId === 'string' ? data.documentId : null,
      documentType,
      patientRut,
      episodeKey,
      caller: {
        uid: context.auth?.uid || null,
        email: context.auth?.token?.email || null,
        name: context.auth?.token?.name || null,
      },
    });

    return {
      fileId: upload.id,
      webViewLink: upload.webViewLink,
      folderPath: `${year}/${monthFolderName}`,
      usedBackend: true,
    };
  }),
});

module.exports = {
  createClinicalDocumentExportFunctions,
};
