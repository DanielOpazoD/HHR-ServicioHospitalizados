const functions = require('firebase-functions/v1');
const { ALLOWED_ASSIGNABLE_ROLES } = require('./authConfig');

const assertRoleMutationAccess = ({ context, callerEmail, adminEmails }) => {
  const hasAdminClaim = context.auth?.token?.role === 'admin';
  const isBootstrapAdmin = !!callerEmail && adminEmails.includes(callerEmail);

  if (!context.auth || (!hasAdminClaim && !isBootstrapAdmin)) {
    throw new functions.https.HttpsError('permission-denied', 'Only admins can set roles');
  }
};

const parseRoleMutationRequest = data => {
  const rawEmail = typeof data?.email === 'string' ? data.email : '';
  const rawRole = typeof data?.role === 'string' ? data.role : '';

  return { rawEmail, rawRole };
};

const assertAssignableRole = (email, role) => {
  if (!email || !role) {
    throw new functions.https.HttpsError('invalid-argument', 'Email and role are required');
  }

  if (!ALLOWED_ASSIGNABLE_ROLES.has(role)) {
    throw new functions.https.HttpsError(
      'invalid-argument',
      `Invalid role. Allowed roles: ${Array.from(ALLOWED_ASSIGNABLE_ROLES).join(', ')}`
    );
  }
};

module.exports = {
  assertAssignableRole,
  assertRoleMutationAccess,
  parseRoleMutationRequest,
};
