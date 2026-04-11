const functions = require('firebase-functions/v1');
const { HOSPITAL_ID } = require('./mirrorConfig');
const { sanitizeLogValue } = require('../logging/redaction');

const createMirrorWriteHandler = ({ collection, logLabel, preserveDeletes = false, dbBeta }) =>
  functions.firestore
    .document(`hospitals/${HOSPITAL_ID}/${collection}/{docId}`)
    .onWrite(async (change, context) => {
      const { docId } = context.params;

      if (!dbBeta) {
        console.error(
          'dbBeta is not initialized for mirror write handler',
          sanitizeLogValue({ collection })
        );
        return null;
      }

      const path = `hospitals/${HOSPITAL_ID}/${collection}/${docId}`;

      try {
        if (!change.after.exists) {
          if (preserveDeletes) {
            console.warn(
              'Official document deleted; preserving beta copy',
              sanitizeLogValue({ path })
            );
            return null;
          }

          return await dbBeta.doc(path).delete();
        }

        return await dbBeta.doc(path).set(change.after.data());
      } catch (error) {
        console.error(
          'Error syncing mirrored collection write',
          sanitizeLogValue({ collection, logLabel, docId, error })
        );
        return null;
      }
    });

module.exports = {
  createMirrorWriteHandler,
};
