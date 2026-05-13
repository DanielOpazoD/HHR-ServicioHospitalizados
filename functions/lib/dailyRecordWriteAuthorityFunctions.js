const functions = require('firebase-functions/v1');
const { HOSPITAL_ID } = require('./runtime/runtimeConfig');
const { requireAuthenticatedEmail } = require('./auth/authPolicies');
const { sanitizeLogValue } = require('./logging/redaction');
const { evaluateDailyRecordClinicalAuthority } = require('./dailyRecordClinicalAuthorityPolicy');

const ALLOWED_DAILY_RECORD_WRITE_ROLES = new Set([
  'admin',
  'doctor',
  'doctor_specialist',
  'nurse',
  'matron',
]);

const assertStringField = (value, fieldName) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Missing required field: ${fieldName}`
    );
  }

  return value.trim();
};

const isPlainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

const toMillis = value => {
  if (!value) return 0;
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const assertExpectedVersion = ({ snapshot, expectedLastUpdated }) => {
  if (!expectedLastUpdated || !snapshot.exists) {
    return;
  }

  const remoteLastUpdated = snapshot.data()?.lastUpdated;
  if (!remoteLastUpdated) {
    return;
  }

  const remoteMillis = toMillis(remoteLastUpdated);
  const expectedMillis = toMillis(expectedLastUpdated);
  if (remoteMillis > expectedMillis) {
    throw new functions.https.HttpsError(
      'aborted',
      'Daily record changed remotely before the authorized write transaction.'
    );
  }
};

const assertClinicalAuthority = record => {
  const result = evaluateDailyRecordClinicalAuthority(record);
  if (result.status === 'ok') {
    return;
  }

  throw new functions.https.HttpsError(
    'failed-precondition',
    result.violations.map(violation => violation.message).join(' ')
  );
};

const parsePayload = data => {
  const date = assertStringField(data?.date, 'date');
  const record = data?.record;
  if (!isPlainObject(record)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Daily record payload must be an object.'
    );
  }

  if (record.date !== date) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      'Daily record payload date does not match request date.'
    );
  }

  return {
    date,
    record,
    expectedLastUpdated:
      typeof data?.expectedLastUpdated === 'string' ? data.expectedLastUpdated : undefined,
  };
};

const createDailyRecordWriteAuthorityFunctions = ({ admin, resolveRoleForEmail }) => ({
  saveDailyRecordWithClinicalAuthority: functions.https.onCall(async (data, context) => {
    const email = requireAuthenticatedEmail(context);
    const resolvedRole = await resolveRoleForEmail(email);

    if (!ALLOWED_DAILY_RECORD_WRITE_ROLES.has(resolvedRole)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only authorized clinical users can save daily records.'
      );
    }

    const { date, record, expectedLastUpdated } = parsePayload(data);
    assertClinicalAuthority(record);

    const db = admin.firestore();
    const docRef = db.collection('hospitals').doc(HOSPITAL_ID).collection('dailyRecords').doc(date);

    try {
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(docRef);
        assertExpectedVersion({ snapshot, expectedLastUpdated });

        const now = admin.firestore.Timestamp.now();
        if (snapshot.exists) {
          const historyRef = docRef.collection('history').doc(new Date().toISOString());
          transaction.set(historyRef, {
            ...(snapshot.data() || {}),
            snapshotTimestamp: now,
          });
        }

        transaction.set(docRef, {
          ...record,
          lastUpdated: now,
        });
      });

      return {
        success: true,
        date,
      };
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        throw error;
      }

      console.error(
        'Error saving daily record with clinical authority',
        sanitizeLogValue({ email, date, error })
      );
      throw new functions.https.HttpsError(
        'internal',
        'Failed to save daily record with clinical authority.'
      );
    }
  }),
});

module.exports = {
  createDailyRecordWriteAuthorityFunctions,
};
