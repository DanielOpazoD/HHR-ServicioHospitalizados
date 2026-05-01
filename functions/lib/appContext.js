const admin = require('firebase-admin');
const { HOSPITAL_CAPACITY, ensureFirebaseProjectRuntimeEnv } = require('./runtime/runtimeConfig');
const { createMirrorSecondaryFirestore } = require('./mirror/mirrorSecondaryFirestoreFactory');

ensureFirebaseProjectRuntimeEnv();
admin.initializeApp();

const dbBeta = createMirrorSecondaryFirestore(admin);
module.exports = {
  admin,
  dbBeta,
  HOSPITAL_CAPACITY,
};
