const { MIRROR_WRITE_COLLECTIONS } = require('./mirror/mirrorFunctionRegistry');
const { createMirrorWriteHandler } = require('./mirror/mirrorWriteHandlerFactory');

const createMirrorFunctions = ({ dbBeta }) =>
  Object.fromEntries(
    MIRROR_WRITE_COLLECTIONS.map(entry => [
      entry.exportName,
      createMirrorWriteHandler({
        collection: entry.collection,
        logLabel: entry.logLabel,
        dbBeta,
      }),
    ])
  );

module.exports = {
  createMirrorFunctions,
};
