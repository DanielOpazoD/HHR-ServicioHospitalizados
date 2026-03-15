const {
  BOOTSTRAP_ADMIN_EMAILS,
  SHARED_CENSUS_ALLOWLIST_EMAILS,
  GENERAL_LOGIN_ROLES,
} = require('./authConfig');
const { normalizeEmail } = require('./authPolicies');

const createAuthHelpers = admin => {
  const resolveRoleForEmail = async email => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return 'unauthorized';

    try {
      const roleDoc = await admin.firestore().collection('config').doc('roles').get();
      if (roleDoc.exists) {
        const rolesMap = roleDoc.data() || {};
        if (rolesMap[cleanEmail]) {
          return rolesMap[cleanEmail];
        }
      }
    } catch (error) {
      console.warn(
        `⚠️ resolveRoleForEmail dynamic lookup failed for ${cleanEmail}: ${error.message}`
      );
    }

    if (BOOTSTRAP_ADMIN_EMAILS.includes(cleanEmail)) return 'admin';

    return 'unauthorized';
  };

  const hasCallableClinicalAccess = async context => {
    if (!context?.auth) return false;

    const callerEmail = normalizeEmail(context.auth.token?.email);
    if (!callerEmail) return false;
    const resolvedRole = await resolveRoleForEmail(callerEmail);
    return GENERAL_LOGIN_ROLES.has(resolvedRole);
  };

  const isSharedCensusEmailAuthorized = async email => {
    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail) return { authorized: false, role: 'viewer' };

    if (SHARED_CENSUS_ALLOWLIST_EMAILS.includes(cleanEmail)) {
      return { authorized: true, role: 'viewer' };
    }

    try {
      const docSnap = await admin
        .firestore()
        .collection('census-authorized-emails')
        .doc(cleanEmail)
        .get();

      if (!docSnap.exists) {
        return { authorized: false, role: 'viewer' };
      }

      const data = docSnap.data() || {};
      const role = data.role === 'downloader' ? 'downloader' : 'viewer';
      return { authorized: true, role };
    } catch (error) {
      console.error(`❌ Shared census authorization lookup failed for ${cleanEmail}:`, error);
      return { authorized: false, role: 'viewer' };
    }
  };

  const assignRole = async user => {
    const email = normalizeEmail(user.email);
    const role = await resolveRoleForEmail(email);

    try {
      await admin.auth().setCustomUserClaims(user.uid, { role });
      return role;
    } catch (error) {
      console.error(`❌ Error assigning role to ${email}:`, error);
      throw error;
    }
  };

  return {
    normalizeEmail,
    resolveRoleForEmail,
    hasCallableClinicalAccess,
    isSharedCensusEmailAuthorized,
    assignRole,
    adminEmails: BOOTSTRAP_ADMIN_EMAILS,
  };
};

module.exports = {
  createAuthHelpers,
};
