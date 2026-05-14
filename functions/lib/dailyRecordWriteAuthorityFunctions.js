const functions = require('firebase-functions/v1');
const { HOSPITAL_ID } = require('./runtime/runtimeConfig');
const { requireAuthenticatedEmail } = require('./auth/authPolicies');
const { sanitizeLogValue } = require('./logging/redaction');
const {
  collectClinicalEpisodeCoverage,
  evaluateDailyRecordClinicalAuthority,
} = require('./dailyRecordClinicalAuthorityPolicy');

const ALLOWED_DAILY_RECORD_WRITE_ROLES = new Set([
  'admin',
  'nurse_hospital',
  'doctor_urgency',
  'doctor_specialist',
  'editor',
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

const normalizeMode = value => (value === 'shadow' ? 'shadow' : 'enforced');

const normalizeOrigin = value =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, 80) : 'direct_save';

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
  return result;
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
    mode: normalizeMode(data?.mode),
    origin: normalizeOrigin(data?.origin),
    dryRun: data?.dryRun === true,
    syncContract: isPlainObject(data?.syncContract) ? data.syncContract : undefined,
    expectedLastUpdated:
      typeof data?.expectedLastUpdated === 'string' ? data.expectedLastUpdated : undefined,
  };
};

const buildAuthorityResponse = ({ date, mode, authority, coverage }) => ({
  success: authority.status === 'ok',
  date,
  mode,
  authorityStatus: authority.status,
  coverage,
  violations: authority.violations.map(violation => ({
    type: violation.type,
    path: violation.path,
    bedId: violation.bedId,
  })),
});

const recordAuthorityTelemetry = async ({
  admin,
  date,
  mode,
  origin,
  dryRun,
  authority,
  coverage,
  syncContract,
  status,
  errorCode,
  errorMessage,
  startedAt,
}) => {
  try {
    const changedPaths = Array.isArray(syncContract?.changedPaths) ? syncContract.changedPaths : [];
    await admin
      .firestore()
      .collection('hospitals')
      .doc(HOSPITAL_ID)
      .collection('functionsTelemetry')
      .add({
        service: 'dailyRecordWriteAuthority',
        operation: 'saveDailyRecordWithClinicalAuthority',
        hospitalId: HOSPITAL_ID,
        durationMs: Date.now() - startedAt,
        attempt: 1,
        totalAttempts: 1,
        status,
        errorCode,
        errorMessage,
        timestamp: new Date().toISOString(),
        context: {
          date,
          mode,
          origin,
          dryRun,
          authorityStatus: authority.status,
          violationCount: authority.violations.length,
          violationTypes: authority.violations.map(violation => violation.type).join(','),
          changedPathsCount: changedPaths.length,
          hasExpectedVersion: Boolean(syncContract?.expectedVersion),
          activePatients: coverage.activePatients,
          canonicalEpisodeIds: coverage.canonicalEpisodeIds,
          fallbackEpisodeKeys: coverage.fallbackEpisodeKeys,
          degenerateFallbackEpisodeKeys: coverage.degenerateFallbackEpisodeKeys,
        },
      });
  } catch (error) {
    console.warn(
      'Failed to record daily record authority telemetry',
      sanitizeLogValue({ date, error })
    );
  }
};

const createDailyRecordWriteAuthorityFunctions = ({ admin, resolveRoleForEmail }) => ({
  saveDailyRecordWithClinicalAuthority: functions.https.onCall(async (data, context) => {
    const startedAt = Date.now();
    const email = requireAuthenticatedEmail(context);
    const resolvedRole = await resolveRoleForEmail(email);

    if (!ALLOWED_DAILY_RECORD_WRITE_ROLES.has(resolvedRole)) {
      throw new functions.https.HttpsError(
        'permission-denied',
        'Only authorized clinical users can save daily records.'
      );
    }

    const { date, record, expectedLastUpdated, mode, origin, dryRun, syncContract } =
      parsePayload(data);
    const authority = assertClinicalAuthority(record);
    const coverage = collectClinicalEpisodeCoverage(record);

    if (authority.status !== 'ok') {
      await recordAuthorityTelemetry({
        admin,
        date,
        mode,
        origin,
        dryRun,
        authority,
        coverage,
        syncContract,
        status: 'failure',
        errorCode: 'failed-precondition',
        errorMessage: 'Daily record clinical authority blocked write.',
        startedAt,
      });
      throw new functions.https.HttpsError(
        'failed-precondition',
        authority.violations.map(violation => violation.message).join(' ')
      );
    }

    const db = admin.firestore();
    const docRef = db.collection('hospitals').doc(HOSPITAL_ID).collection('dailyRecords').doc(date);

    try {
      await db.runTransaction(async transaction => {
        const snapshot = await transaction.get(docRef);
        assertExpectedVersion({ snapshot, expectedLastUpdated });

        if (dryRun) {
          return;
        }

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

      await recordAuthorityTelemetry({
        admin,
        date,
        mode,
        origin,
        dryRun,
        authority,
        coverage,
        syncContract,
        status: 'success',
        startedAt,
      });

      return buildAuthorityResponse({ date, mode, authority, coverage });
    } catch (error) {
      if (error instanceof functions.https.HttpsError) {
        await recordAuthorityTelemetry({
          admin,
          date,
          mode,
          origin,
          dryRun,
          authority,
          coverage,
          syncContract,
          status: 'failure',
          errorCode: error.code,
          errorMessage: error.message,
          startedAt,
        });
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
