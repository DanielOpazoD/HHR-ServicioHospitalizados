import type { DailyRecord } from '@/types/domain/dailyRecord';

export const EXPLICIT_LOCAL_CENSUS_PATCH_FIELDS = new Set([
  'pathology',
  'specialty',
  'secondarySpecialty',
  'status',
]);

const normalizeEpisodeScalar = (value: unknown): string =>
  String(value || '')
    .trim()
    .toLowerCase();

export const isSameEpisodeForExplicitCensusPatch = (
  remotePatient: DailyRecord['beds'][string] | undefined,
  localPatient: DailyRecord['beds'][string] | undefined
): boolean => {
  if (!remotePatient || !localPatient) {
    return false;
  }

  const remoteEpisodeId = normalizeEpisodeScalar(remotePatient.clinicalEpisodeId);
  const localEpisodeId = normalizeEpisodeScalar(localPatient.clinicalEpisodeId);
  if (remoteEpisodeId || localEpisodeId) {
    return Boolean(remoteEpisodeId && localEpisodeId && remoteEpisodeId === localEpisodeId);
  }

  const remoteRut = normalizeEpisodeScalar(remotePatient.rut);
  const localRut = normalizeEpisodeScalar(localPatient.rut);
  if (remoteRut || localRut) {
    if (!remoteRut || !localRut || remoteRut !== localRut) {
      return false;
    }
    const remoteAnchor = normalizeEpisodeScalar(
      remotePatient.firstSeenDate || remotePatient.admissionDate
    );
    const localAnchor = normalizeEpisodeScalar(
      localPatient.firstSeenDate || localPatient.admissionDate
    );
    if (!remoteAnchor || !localAnchor || remoteAnchor !== localAnchor) {
      return false;
    }
    const remoteTime = normalizeEpisodeScalar(remotePatient.admissionTime);
    const localTime = normalizeEpisodeScalar(localPatient.admissionTime);
    return !remoteTime && !localTime ? true : remoteTime === localTime;
  }

  const remoteName = normalizeEpisodeScalar(remotePatient.patientName);
  const localName = normalizeEpisodeScalar(localPatient.patientName);
  const remoteAnchor = normalizeEpisodeScalar(
    remotePatient.firstSeenDate || remotePatient.admissionDate
  );
  const localAnchor = normalizeEpisodeScalar(
    localPatient.firstSeenDate || localPatient.admissionDate
  );
  return Boolean(
    remoteName &&
    localName &&
    remoteName === localName &&
    remoteAnchor &&
    remoteAnchor === localAnchor
  );
};
