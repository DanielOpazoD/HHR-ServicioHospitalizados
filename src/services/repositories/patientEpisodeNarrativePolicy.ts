import type { PatientData } from '@/services/contracts/patientServiceContracts';
import { resolveClinicalEpisodeIdentifier } from '@/application/patient-flow/clinicalEpisode';

const EPISODE_SCOPED_PATIENT_ARRAY_FIELDS = new Set(['clinicalEvents', 'medicalHandoffEntries']);

const normalizeEpisodeValue = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

const resolveEpisodeAnchor = (patient: PatientData | undefined): string =>
  normalizeEpisodeValue(patient?.firstSeenDate) || normalizeEpisodeValue(patient?.admissionDate);

const resolveEpisodeTime = (patient: PatientData | undefined): string =>
  normalizeEpisodeValue(patient?.admissionTime);

const resolvePersistedClinicalEpisodeId = (patient: PatientData | undefined): string =>
  normalizeEpisodeValue(patient?.clinicalEpisodeId);

const resolveEpisodeTuple = (patient: PatientData | undefined): string => {
  if (!patient) return '';
  const rut = normalizeEpisodeValue(patient?.rut);
  const anchor = resolveEpisodeAnchor(patient);
  if (!rut || !anchor) return '';
  return normalizeEpisodeValue(resolveClinicalEpisodeIdentifier(patient));
};

const areSameRutEpisode = (
  remotePatient: PatientData | undefined,
  localPatient: PatientData | undefined
): boolean => {
  const remoteEpisode = resolveEpisodeTuple(remotePatient);
  const localEpisode = resolveEpisodeTuple(localPatient);
  if (!remoteEpisode || !localEpisode) {
    return true;
  }

  if (remoteEpisode === localEpisode) {
    return true;
  }

  const remoteTime = resolveEpisodeTime(remotePatient);
  const localTime = resolveEpisodeTime(localPatient);
  if (remoteTime || localTime) {
    return false;
  }

  return false;
};

export const shouldPreserveLocalPatientNarrative = (
  remotePatient: PatientData | undefined,
  localPatient: PatientData | undefined
): boolean => {
  if (!remotePatient || !localPatient) {
    return true;
  }

  const remoteClinicalEpisodeId = resolvePersistedClinicalEpisodeId(remotePatient);
  const localClinicalEpisodeId = resolvePersistedClinicalEpisodeId(localPatient);
  if (remoteClinicalEpisodeId && localClinicalEpisodeId) {
    return remoteClinicalEpisodeId === localClinicalEpisodeId;
  }

  const remoteRut = normalizeEpisodeValue(remotePatient.rut);
  const localRut = normalizeEpisodeValue(localPatient.rut);
  if (remoteRut || localRut) {
    if (remoteRut && localRut && remoteRut === localRut) {
      return areSameRutEpisode(remotePatient, localPatient);
    }
    const remoteEpisode = resolveEpisodeAnchor(remotePatient);
    const localEpisode = resolveEpisodeAnchor(localPatient);
    return !remoteEpisode || !localEpisode || remoteEpisode === localEpisode;
  }

  const remoteEpisode = resolveEpisodeAnchor(remotePatient);
  const localEpisode = resolveEpisodeAnchor(localPatient);
  const remoteName = normalizeEpisodeValue(remotePatient.patientName);
  const localName = normalizeEpisodeValue(localPatient.patientName);
  if (remoteName && localName && remoteName !== localName) {
    if (remoteEpisode && localEpisode) {
      return remoteEpisode === localEpisode;
    }
    return !remoteEpisode && !localEpisode;
  }

  return !remoteEpisode || !localEpisode || remoteEpisode === localEpisode;
};

export const shouldUseRemoteEpisodeScopedValue = (
  field: string,
  remotePatient: PatientData | undefined,
  localPatient: PatientData | undefined
): boolean =>
  EPISODE_SCOPED_PATIENT_ARRAY_FIELDS.has(field) &&
  !shouldPreserveLocalPatientNarrative(remotePatient, localPatient);

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
