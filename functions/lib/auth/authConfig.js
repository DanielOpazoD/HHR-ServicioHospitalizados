// Bootstrap admin emails: configurable via BOOTSTRAP_ADMIN_EMAILS env var
// (comma-separated). Falls back to the hardcoded defaults when unset.
const BOOTSTRAP_ADMIN_EMAILS = (
  process.env.BOOTSTRAP_ADMIN_EMAILS || 'daniel.opazo@hospitalhangaroa.cl,d.opazo.damiani@gmail.com'
)
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const MANAGED_ASSIGNABLE_ROLES = new Set([
  'admin',
  'nurse_hospital',
  'doctor_urgency',
  'doctor_specialist',
  'viewer',
  'unauthorized',
]);

const GENERAL_LOGIN_ROLES = new Set([
  'admin',
  'nurse_hospital',
  'doctor_urgency',
  'doctor_specialist',
  'viewer',
  'editor',
]);

module.exports = {
  BOOTSTRAP_ADMIN_EMAILS,
  MANAGED_ASSIGNABLE_ROLES,
  GENERAL_LOGIN_ROLES,
};
