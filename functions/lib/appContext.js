const admin = require('firebase-admin');
const { HOSPITAL_CAPACITY } = require('./runtime/runtimeConfig');
const { createMirrorSecondaryFirestore } = require('./mirror/mirrorSecondaryFirestoreFactory');

admin.initializeApp();

const dbBeta = createMirrorSecondaryFirestore(admin);
module.exports = {
  admin,
  dbBeta,
  HOSPITAL_CAPACITY,
};
