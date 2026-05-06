/**
 * Prescription Cleanup Cloud Function
 *
 * Scheduled job that hard-deletes prescription records (Firestore doc +
 * both Storage blobs) once their `expiresAt` passes. Runs daily.
 *
 * The retention window is encoded at upload time in `expiresAt`, so this
 * function does not need to know about per-type retention rules — it just
 * compares against `now`. If the retention map ever changes, only future
 * uploads pick up the new value (existing records keep the timestamp
 * stamped at their creation).
 */

const functions = require('firebase-functions/v1');
const { HOSPITAL_ID } = require('./runtime/runtimeConfig');

const BATCH_SIZE = 200;

const getPrescriptionsRef = admin =>
  admin.firestore().collection('hospitals').doc(HOSPITAL_ID).collection('prescriptions');

const getAuditLogsRef = admin =>
  admin.firestore().collection('hospitals').doc(HOSPITAL_ID).collection('auditLogs');

const resolveRecordDate = iso => {
  if (!iso) return undefined;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(
    date.getDate()
  ).padStart(2, '0')}`;
};

const sanitizeAuditIdPart = value =>
  String(value || 'unknown')
    .replace(/[^a-zA-Z0-9_-]/g, '-')
    .slice(0, 80);

const createRetentionAuditEntry = ({ docId, data, nowIso }) => ({
  id: `prescription-retention-${sanitizeAuditIdPart(docId)}-${Date.now()}`,
  timestamp: nowIso,
  userId: 'system:prescription-retention',
  action: 'PRESCRIPTION_RETENTION_DELETED',
  entityType: 'prescription',
  entityId: docId,
  patientRut: data.patientRut,
  patientIdentifier: data.patientRut,
  recordDate: resolveRecordDate(data.createdAt),
  details: {
    prescriptionId: docId,
    prescriptionType: data.prescriptionType,
    bedId: data.bedId,
    patientName: data.patientName,
    patientRut: data.patientRut,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    deletedAt: nowIso,
    deletionMode: 'retention',
  },
});

const writeRetentionAuditEntry = async (admin, entry) => {
  await getAuditLogsRef(admin).doc(entry.id).set(entry);
};

const deleteStorageBlobIfPresent = async (bucket, path) => {
  if (!path) return;
  try {
    await bucket.file(path).delete({ ignoreNotFound: true });
  } catch (error) {
    // Surface the failure and keep the Firestore document so the next
    // scheduled run can retry deleting the still-referenced blob.
    console.error(`[prescriptions/cleanup] failed to delete blob ${path}:`, error.message);
    throw error;
  }
};

/**
 * Deletes up to `BATCH_SIZE` expired prescriptions in a single invocation.
 * Returns counts the scheduler can log. Exported for tests.
 */
const deleteExpiredPrescriptions = async (admin, nowIso) => {
  const snapshot = await getPrescriptionsRef(admin)
    .where('expiresAt', '<', nowIso)
    .limit(BATCH_SIZE)
    .get();

  if (snapshot.empty) {
    return { scanned: 0, deleted: 0, failed: 0 };
  }

  const bucket = admin.storage().bucket();
  let deleted = 0;
  let failed = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data() || {};
    const fullPath = data?.image?.storagePath;
    const thumbPath = data?.image?.thumbnailStoragePath;

    try {
      // Storage delete first; only delete the Firestore doc if both blobs
      // are gone. If a blob delete fails (transient), we leave the doc
      // pointing at it so the next run retries instead of orphaning.
      await deleteStorageBlobIfPresent(bucket, fullPath);
      await deleteStorageBlobIfPresent(bucket, thumbPath);
      await writeRetentionAuditEntry(
        admin,
        createRetentionAuditEntry({ docId: doc.id, data, nowIso })
      );
      await doc.ref.delete();
      deleted += 1;
    } catch (_error) {
      failed += 1;
    }
  }

  return { scanned: snapshot.size, deleted, failed };
};

const createCleanupSchedule = ({ admin }) =>
  functions.pubsub
    .schedule('every 24 hours')
    .timeZone('America/Santiago')
    .onRun(async () => {
      const nowIso = new Date().toISOString();
      const result = await deleteExpiredPrescriptions(admin, nowIso);
      console.log(
        `[prescriptions/cleanup] runAt=${nowIso} scanned=${result.scanned} deleted=${result.deleted} failed=${result.failed}`
      );
      return null;
    });

const createPrescriptionCleanupFunctions = ({ admin }) => ({
  cleanExpiredPrescriptions: createCleanupSchedule({ admin }),
});

module.exports = {
  createPrescriptionCleanupFunctions,
  deleteExpiredPrescriptions,
};
