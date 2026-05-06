const { admin, dbBeta, HOSPITAL_CAPACITY } = require('./lib/appContext');
const { createMirrorFunctions } = require('./lib/mirrorFunctions');
const { createAuthHelpers, createAuthFunctions } = require('./lib/authFunctions');
const { createMinsalFunctions } = require('./lib/minsalFunctions');
const { createHandoffSignatureFunctions } = require('./lib/handoffSignatureFunctions');
const {
  createSpecialistMedicalHandoffFunctions,
} = require('./lib/specialistMedicalHandoffFunctions');
const { createClinicalDocumentExportFunctions } = require('./lib/clinicalDocumentExportFunctions');
const {
  createClinicalDocumentPdfRenderFunctions,
} = require('./lib/clinicalDocumentPdfRenderFunctions');
const { createWoundCareMobileUploadFunctions } = require('./lib/woundCareMobileUploadFunctions');
const { createPrescriptionAccessFunctions } = require('./lib/prescriptionAccessFunctions');
const { createPrescriptionCleanupFunctions } = require('./lib/prescriptionCleanupFunctions');

const authHelpers = createAuthHelpers(admin);

module.exports = {
  ...createMirrorFunctions({ dbBeta, admin }),
  ...createMinsalFunctions({
    admin,
    hospitalCapacity: HOSPITAL_CAPACITY,
    hasCallableClinicalAccess: authHelpers.hasCallableClinicalAccess,
  }),
  ...createAuthFunctions({
    admin,
    helpers: authHelpers,
  }),
  ...createHandoffSignatureFunctions({
    admin,
  }),
  ...createSpecialistMedicalHandoffFunctions({
    admin,
    resolveRoleForEmail: authHelpers.resolveRoleForEmail,
  }),
  ...createClinicalDocumentExportFunctions({
    admin,
    resolveRoleForEmail: authHelpers.resolveRoleForEmail,
  }),
  ...createClinicalDocumentPdfRenderFunctions({
    resolveRoleForEmail: authHelpers.resolveRoleForEmail,
  }),
  ...createWoundCareMobileUploadFunctions({
    admin,
  }),
  ...createPrescriptionAccessFunctions({
    admin,
    resolveRoleForEmail: authHelpers.resolveRoleForEmail,
  }),
  ...createPrescriptionCleanupFunctions({
    admin,
  }),
};
