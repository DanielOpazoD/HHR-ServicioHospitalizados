const functions = require('firebase-functions/v1');

const readMirrorRuntimeConfig = () => {
  try {
    return typeof functions.config === 'function' ? functions.config() || {} : {};
  } catch (_error) {
    return {};
  }
};

const parseMirrorSecondaryServiceAccount = () => {
  const runtimeConfig = readMirrorRuntimeConfig();
  const rawJson =
    process.env.BETA_SERVICE_ACCOUNT_JSON || runtimeConfig?.mirror?.beta_service_account_json;
  const rawB64 =
    process.env.BETA_SERVICE_ACCOUNT_JSON_B64 ||
    runtimeConfig?.mirror?.beta_service_account_json_b64;

  if (!rawJson && !rawB64) {
    return null;
  }

  try {
    const json = rawJson || Buffer.from(rawB64, 'base64').toString('utf8');
    return JSON.parse(json);
  } catch (error) {
    console.error('BETA service account secret is malformed:', error.message);
    return null;
  }
};

const createMirrorSecondaryFirestore = admin => {
  const serviceAccountCredentials = parseMirrorSecondaryServiceAccount();
  if (!serviceAccountCredentials) {
    console.error(
      'Missing BETA service account secret. Configure BETA_SERVICE_ACCOUNT_JSON/B64 (or functions config mirror.beta_service_account_json/_b64).'
    );
    return null;
  }

  try {
    const secondaryApp = admin.initializeApp(
      {
        credential: admin.credential.cert(serviceAccountCredentials),
      },
      'secondary'
    );
    return secondaryApp.firestore();
  } catch (error) {
    console.error('Failed to initialize secondary Firebase app:', error.message);
    return null;
  }
};

module.exports = {
  createMirrorSecondaryFirestore,
  parseMirrorSecondaryServiceAccount,
};
