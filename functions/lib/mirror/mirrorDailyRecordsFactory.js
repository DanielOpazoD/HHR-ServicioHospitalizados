const functions = require('firebase-functions/v1');
const { HOSPITAL_ID } = require('./mirrorConfig');
const {
  canParseMirrorRecordDate,
  shouldSkipMirroringDailyRecord,
} = require('./mirrorRuntimeSupport');
const { sanitizeLogValue } = require('../logging/redaction');

const createMirrorDailyRecords = ({ dbBeta, admin }) =>
  functions.firestore
    .document(`hospitals/${HOSPITAL_ID}/dailyRecords/{docId}`)
    .onWrite(async (change, context) => {
      const { docId } = context.params;

      if (!dbBeta) {
        console.error(
          'dbBeta is not initialized for daily record mirroring',
          sanitizeLogValue({ docId })
        );
        return null;
      }

      try {
        const docDate = canParseMirrorRecordDate(docId);
        if (docDate && shouldSkipMirroringDailyRecord({ docId, now: Date.now() })) {
          return null;
        }
      } catch (dateError) {
        console.warn(
          'Unable to parse mirror record date',
          sanitizeLogValue({ docId, error: dateError })
        );
      }

      const path = `hospitals/${HOSPITAL_ID}/dailyRecords/${docId}`;

      try {
        if (!change.after.exists) {
          console.warn('Official document deleted; keeping beta copy', sanitizeLogValue({ path }));
          return null;
        }

        const sourceData = change.after.data();
        const sourceLastUpdated = sourceData.lastUpdated?.toMillis
          ? sourceData.lastUpdated.toMillis()
          : 0;

        const betaDoc = await dbBeta.doc(path).get();
        if (betaDoc.exists) {
          const betaData = betaDoc.data();
          const betaSyncedAt = betaData._syncedAt?.toMillis ? betaData._syncedAt.toMillis() : 0;
          const betaLastUpdated = betaData.lastUpdated?.toMillis
            ? betaData.lastUpdated.toMillis()
            : 0;
          if (
            shouldSkipMirroringDailyRecord({
              docId,
              sourceLastUpdatedMs: sourceLastUpdated,
              betaSyncedAtMs: betaSyncedAt,
              betaLastUpdatedMs: betaLastUpdated,
              now: Date.now(),
            })
          ) {
            return null;
          }
        }

        return await dbBeta.doc(path).set({
          ...sourceData,
          _syncedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (error) {
        console.error('Error syncing mirrored daily record', sanitizeLogValue({ docId, error }));
        return null;
      }
    });

module.exports = {
  createMirrorDailyRecords,
};
