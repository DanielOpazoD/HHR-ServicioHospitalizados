import type { PatientData } from '@/services/contracts/patientServiceContracts';

const normalizeEpisodeValue = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const resolveEpisodeAnchor = (patient: PatientData | undefined): string =>
  normalizeEpisodeValue(patient?.firstSeenDate) || normalizeEpisodeValue(patient?.admissionDate);

export const shouldPreserveLocalPatientNarrative = (
  remotePatient: PatientData | undefined,
  localPatient: PatientData | undefined
): boolean => {
  if (!remotePatient || !localPatient) {
    return true;
  }

  const remoteRut = normalizeEpisodeValue(remotePatient.rut);
  const localRut = normalizeEpisodeValue(localPatient.rut);
  if (remoteRut || localRut) {
    return Boolean(remoteRut && localRut && remoteRut === localRut);
  }

  const remoteName = normalizeEpisodeValue(remotePatient.patientName);
  const localName = normalizeEpisodeValue(localPatient.patientName);
  if (!remoteName && !localName) {
    return true;
  }
  if (!remoteName || !localName || remoteName !== localName) {
    return false;
  }

  const remoteEpisode = resolveEpisodeAnchor(remotePatient);
  const localEpisode = resolveEpisodeAnchor(localPatient);
  return !remoteEpisode || !localEpisode || remoteEpisode === localEpisode;
};

export const hasPatientIdentityOrClinicalContent = (patient: PatientData | undefined): boolean => {
  if (!patient) return false;
  const normalizedStatus = String(patient.status || '').trim();
  return Boolean(
    String(patient.patientName || '').trim() ||
    String(patient.rut || '').trim() ||
    String(patient.pathology || '').trim() ||
    String(patient.admissionDate || '').trim() ||
    (normalizedStatus && normalizedStatus !== 'EMPTY')
  );
};

export const isLocallyClearedPatient = (patient: PatientData | undefined): boolean =>
  Boolean(
    patient &&
    !String(patient.patientName || '').trim() &&
    !String(patient.rut || '').trim() &&
    !String(patient.pathology || '').trim() &&
    !String(patient.admissionDate || '').trim()
  );
