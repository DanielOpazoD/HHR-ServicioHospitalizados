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
  MANAGED_ASSIGNABLE_ROLES,
  GENERAL_LOGIN_ROLES,
};
