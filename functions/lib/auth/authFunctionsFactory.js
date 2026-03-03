const functions = require('firebase-functions/v1');
const { CLINICAL_CALLABLE_ROLES } = require('./authConfig');
const {
  assertAssignableRole,
  assertRoleMutationAccess,
  parseRoleMutationRequest,
} = require('./authCallablePolicy');
const { requireAuthenticatedEmail, upsertAllowedUserRole } = require('./authPolicies');

const createAuthFunctions = ({ admin, helpers }) => ({
  onUserCreated: functions.auth.user().onCreate(async user => helpers.assignRole(user)),
  setUserRole: functions.https.onCall(async (data, context) => {
    const callerEmail = helpers.normalizeEmail(context.auth?.token?.email);
    assertRoleMutationAccess({
      context,
      callerEmail,
      adminEmails: helpers.adminEmails,
    });

    const { rawEmail, rawRole } = parseRoleMutationRequest(data);
    const email = helpers.normalizeEmail(rawEmail);
    const role = helpers.normalizeEmail(rawRole);
    assertAssignableRole(email, role);

    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      await admin.auth().setCustomUserClaims(userRecord.uid, { role });
      await upsertAllowedUserRole(admin, userRecord.uid, email, role);
      return { success: true, message: `Role ${role} assigned to ${email}` };
    } catch (error) {
      console.error(`Error setting role for ${email}:`, error);
      throw new functions.https.HttpsError('internal', 'Failed to update user role');
    }
  }),
  checkUserRole: functions.https.onCall(async (_data, context) => {
    const email = requireAuthenticatedEmail(context);

    try {
      const role = await helpers.resolveRoleForEmail(email);
      return { role };
    } catch (error) {
      console.error(`❌ Discovery Error for ${email}:`, error);
      throw new functions.https.HttpsError('internal', 'Error retrieving account permissions.');
    }
  }),
  checkSharedCensusAccess: functions.https.onCall(async (_data, context) => {
    const email = requireAuthenticatedEmail(context);

    const roleClaim = context.auth.token?.role;
    if (roleClaim && CLINICAL_CALLABLE_ROLES.has(roleClaim)) {
      return { authorized: true, role: 'downloader' };
    }

    const roleFromConfig = await helpers.resolveRoleForEmail(email);
    if (CLINICAL_CALLABLE_ROLES.has(roleFromConfig)) {
      return { authorized: true, role: 'downloader' };
    }

    const authorization = await helpers.isSharedCensusEmailAuthorized(email);
    return {
      authorized: authorization.authorized,
      role: authorization.role,
    };
  }),
});

module.exports = {
  createAuthFunctions,
};
