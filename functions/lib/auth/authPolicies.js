const functions = require('firebase-functions/v1');
const { normalizeEmail } = require('./authEmailUtils');

const requireAuthenticatedEmail = context => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'User must be signed in.');
  }

  const email = normalizeEmail(context.auth.token?.email);
  if (!email) {
    throw new functions.https.HttpsError('invalid-argument', 'User has no email associated.');
  }

  return email;
};

module.exports = {
  normalizeEmail,
  requireAuthenticatedEmail,
};
