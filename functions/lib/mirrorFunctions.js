const { createMirrorDailyRecords } = require('./mirror/mirrorDailyRecordsFactory');
const { MIRROR_WRITE_COLLECTIONS } = require('./mirror/mirrorFunctionRegistry');
const { createMirrorWriteHandler } = require('./mirror/mirrorWriteHandlerFactory');

const createMirrorFunctions = ({ dbBeta, admin }) => ({
  mirrorDailyRecords: createMirrorDailyRecords({ dbBeta, admin }),
  ...Object.fromEntries(
    MIRROR_WRITE_COLLECTIONS.map(entry => [
      entry.exportName,
      createMirrorWriteHandler({
        collection: entry.collection,
        logLabel: entry.logLabel,
        dbBeta,
      }),
    ])
  ),
});

module.exports = {
  createMirrorFunctions,
};
