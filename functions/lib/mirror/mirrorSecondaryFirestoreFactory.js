const functions = require('firebase-functions/v1');
const { sanitizeLogValue } = require('../logging/redaction');

const readMirrorRuntimeConfig = () => {
  try {
    return typeof functions.config === 'function' ? functions.config() || {} : {};
  } catch (_error) {
    return {};
  }
};

const isNonEmptyString = value => typeof value === 'string' && value.trim().length > 0;

const isValidServiceAccountSecret = credentials =>
  isNonEmptyString(credentials?.project_id) &&
  isNonEmptyString(credentials?.client_email) &&
  isNonEmptyString(credentials?.private_key) &&
  credentials.private_key.includes('BEGIN PRIVATE KEY');

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
    const credentials = JSON.parse(json);
    if (!isValidServiceAccountSecret(credentials)) {
      console.error('BETA service account secret is incomplete', sanitizeLogValue(credentials));
      return null;
    }
    return credentials;
  } catch (error) {
    console.error('BETA service account secret is malformed', sanitizeLogValue({ error }));
    return null;
  }
};

const createMirrorSecondaryFirestore = admin => {
  const serviceAccountCredentials = parseMirrorSecondaryServiceAccount();
  if (!serviceAccountCredentials) {
    console.error('Missing BETA service account secret for mirror initialization');
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
    console.error('Failed to initialize secondary Firebase app', sanitizeLogValue({ error }));
    return null;
  }
};

module.exports = {
  createMirrorSecondaryFirestore,
  parseMirrorSecondaryServiceAccount,
};
