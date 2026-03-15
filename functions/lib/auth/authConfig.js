const BOOTSTRAP_ADMIN_EMAILS = ['daniel.opazo@hospitalhangaroa.cl', 'd.opazo.damiani@gmail.com'];

const SHARED_CENSUS_ALLOWLIST_EMAILS = [
  'arenka.palma@hospitalhangaroa.cl',
  'natalia.arzola@hospitalhangaroa.cl',
  'vaitiare.hereveri@hospitalhangaroa.cl',
  'kaany.pakomio@hospitalhangaroa.cl',
  'claudia.salgado@hospitalhangaroa.cl',
  'bianca.atam@hospitalhangaroa.cl',
  'ana.pont@hospitalhangaroa.cl',
  'katherin.pont@hospitalhangaroa.cl',
  'eyleen.cisternas@hospitalhangaroa.cl',
  'marco.ramirez@hospitalhangaroa.cl',
  'josemiguel.villavicencio@hospitalhangaroa.cl',
  'carla.curinao@hospitalhangaroa.cl',
  'epidemiologia@hospitalhangaroa.cl',
  'archivosome@hospitalhangaroa.cl',
  'antonio.espinoza@hospitalhangaroa.cl',
  'juan.pakomio@hospitalhangaroa.cl',
  'ivan.pulgar@hospitalhangaroa.cl',
  'daniel.opazo@hospitalhangaroa.cl',
  'andrea.saldana@saludoriente.cl',
  'patricio.medina@saludoriente.cl',
  'gestion.camas@saludoriente.cl',
  'd.opazo.damiani@gmail.com',
  'd.opazo.damiani@hospitalhangaroa.cl',
];

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

const CLINICAL_CALLABLE_ROLES = new Set([...GENERAL_LOGIN_ROLES, 'viewer_census']);

module.exports = {
  BOOTSTRAP_ADMIN_EMAILS,
  SHARED_CENSUS_ALLOWLIST_EMAILS,
  MANAGED_ASSIGNABLE_ROLES,
  GENERAL_LOGIN_ROLES,
  CLINICAL_CALLABLE_ROLES,
};
