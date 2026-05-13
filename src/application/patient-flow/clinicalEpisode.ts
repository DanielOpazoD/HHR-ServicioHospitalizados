import type { PatientEpisodeContract } from '@/application/patient-flow/clinicalEpisodeContracts';
import {
  isNewAdmissionForClinicalDay,
  normalizeDateOnly,
  resolveClinicalDayForDateTime,
} from '@/utils/clinicalDayUtils';

export interface ClinicalEpisode {
  patientRut: string;
  patientName: string;
  admissionDate?: string;
  admissionTime?: string;
  sourceDailyRecordDate?: string;
  sourceBedId?: string;
  specialty?: string;
  episodeKey: string;
}

export interface PatientPresenceSnapshot {
  bedId: string;
  patientRut: string;
  patientName: string;
  admissionDate?: string;
  admissionTime?: string;
  episodeKey: string;
}

export interface PatientMovementClassification {
  isNewAdmission: boolean;
}

export interface ClinicalEpisodeFallbackEvent {
  source?: string;
  reason: 'missing_clinical_episode_id';
  fallbackEpisodeKey: string;
  hasRut: boolean;
  hasAdmissionTime: boolean;
}

export interface ClinicalEpisodeResolutionOptions {
  source?: string;
  onFallback?: (event: ClinicalEpisodeFallbackEvent) => void;
}

export const normalizeClinicalEpisodeTime = (admissionTime?: string): string =>
  String(admissionTime || '').trim();

export const buildClinicalEpisodeKey = (
  patientRut: string,
  admissionDate?: string,
  admissionTime?: string
): string => {
  const baseKey = `${patientRut || 'sin-rut'}__${admissionDate || 'sin-ingreso'}`;
  const normalizedAdmissionTime = normalizeClinicalEpisodeTime(admissionTime);
  return normalizedAdmissionTime ? `${baseKey}__${normalizedAdmissionTime}` : baseKey;
};

export const normalizeClinicalEpisodeId = (clinicalEpisodeId?: string): string =>
  String(clinicalEpisodeId || '').trim();

/**
 * Clinical documents and episode snapshots should anchor to the first observed
 * day of the current episode when the census already resolved it.
 */
export const resolveClinicalEpisodeAdmissionDate = (
  patient: PatientEpisodeContract
): string | undefined => patient.firstSeenDate || patient.admissionDate;

export const resolveClinicalEpisodeIdentifier = (
  patient: PatientEpisodeContract,
  options: ClinicalEpisodeResolutionOptions = {}
): string => {
  const persistedEpisodeId = normalizeClinicalEpisodeId(patient.clinicalEpisodeId);
  if (persistedEpisodeId) {
    return persistedEpisodeId;
  }

  const fallbackEpisodeKey = buildClinicalEpisodeKey(
    patient.rut || '',
    resolveClinicalEpisodeAdmissionDate(patient),
    patient.admissionTime
  );
  options.onFallback?.({
    source: options.source,
    reason: 'missing_clinical_episode_id',
    fallbackEpisodeKey,
    hasRut: Boolean(patient.rut?.trim()),
    hasAdmissionTime: Boolean(normalizeClinicalEpisodeTime(patient.admissionTime)),
  });
  return fallbackEpisodeKey;
};

export const resolveClinicalEpisode = (
  patient: PatientEpisodeContract,
  context?: {
    sourceDailyRecordDate?: string;
    sourceBedId?: string;
  },
  options: ClinicalEpisodeResolutionOptions = {}
): ClinicalEpisode => ({
  patientRut: patient.rut || '',
  patientName: patient.patientName || '',
  admissionDate: resolveClinicalEpisodeAdmissionDate(patient),
  admissionTime: patient.admissionTime,
  sourceDailyRecordDate: context?.sourceDailyRecordDate,
  sourceBedId: context?.sourceBedId,
  specialty: patient.specialty,
  episodeKey: resolveClinicalEpisodeIdentifier(patient, options),
});

export const buildPatientPresenceSnapshot = (
  patient: PatientEpisodeContract,
  bedId: string
): PatientPresenceSnapshot | null => {
  const patientRut = patient.rut?.trim();
  const admissionDate = resolveClinicalEpisodeAdmissionDate(patient)?.trim();
  if (!patientRut || !admissionDate) {
    return null;
  }

  return {
    bedId,
    patientRut,
    patientName: patient.patientName || '',
    admissionDate,
    admissionTime: patient.admissionTime,
    episodeKey: resolveClinicalEpisodeIdentifier(patient),
  };
};

/**
 * Determines whether a patient is a **new admission** on a given census day.
 *
 * Resolution priority:
 *  1. If `firstSeenDate` is set → compare with `recordDate` (modern patients).
 *  2. If `firstSeenDate` is missing but `admissionDate` exists → use
 *     `admissionDate` as anchor (**legacy fallback** for patients created
 *     before `firstSeenDate` was introduced).
 *  3. If neither is set → fall back to `isNewAdmissionForClinicalDay()`
 *     which applies clinical-day shift logic (night shift = next calendar day).
 *
 * A patient is "new" when `recordDate` matches the resolved anchor date.
 * On subsequent days the comparison fails and the badge disappears.
 *
 * @example
 * // Modern patient (firstSeenDate set)
 * classifyPatientMovementForRecord('2026-04-10', {
 *   firstSeenDate: '2026-04-10', admissionDate: '2026-04-10'
 * }); // → { isNewAdmission: true }
 *
 * // Legacy patient (no firstSeenDate)
 * classifyPatientMovementForRecord('2026-04-10', {
 *   admissionDate: '2026-04-10'
 * }); // → { isNewAdmission: true }  (admissionDate fallback)
 *
 * // Next day — no longer new
 * classifyPatientMovementForRecord('2026-04-11', {
 *   firstSeenDate: '2026-04-10', admissionDate: '2026-04-10'
 * }); // → { isNewAdmission: false }
 */
export const classifyPatientMovementForRecord = (
  recordDate: string,
  patient: {
    firstSeenDate?: string;
    admissionDate?: string;
    admissionTime?: string;
  }
): PatientMovementClassification => {
  const normalizedRecordDate = normalizeDateOnly(recordDate);
  const normalizedFirstSeenDate = normalizeDateOnly(patient.firstSeenDate);
  const normalizedAdmissionDate = normalizeDateOnly(patient.admissionDate);
  const shouldResolveAdmissionAnchor =
    Boolean(normalizedFirstSeenDate) || Boolean(patient.admissionTime);
  const resolvedClinicalAdmissionDate =
    normalizedAdmissionDate && shouldResolveAdmissionAnchor
      ? resolveClinicalEpisodeAdmissionAnchorDate({
          firstSeenDate: normalizedFirstSeenDate,
          admissionDate: normalizedAdmissionDate,
          admissionTime: patient.admissionTime,
        })
      : // Legacy fallback: use admissionDate as anchor when firstSeenDate
        // was never set (patients created before the feature existed).
        normalizedFirstSeenDate || normalizedAdmissionDate;

  if (normalizedRecordDate && resolvedClinicalAdmissionDate) {
    return {
      isNewAdmission: normalizedRecordDate === resolvedClinicalAdmissionDate,
    };
  }

  return {
    isNewAdmission: isNewAdmissionForClinicalDay(
      recordDate,
      patient.admissionDate,
      patient.admissionTime
    ),
  };
};

const resolveClinicalEpisodeAdmissionAnchorDate = ({
  firstSeenDate,
  admissionDate,
  admissionTime,
}: {
  firstSeenDate?: string;
  admissionDate: string;
  admissionTime?: string;
}): string => {
  const clinicalAdmissionDate =
    resolveClinicalDayForAdmission(admissionDate, admissionTime) ?? admissionDate;

  if (!firstSeenDate) {
    return clinicalAdmissionDate;
  }

  return firstSeenDate < clinicalAdmissionDate ? firstSeenDate : clinicalAdmissionDate;
};

const resolveClinicalDayForAdmission = (
  admissionDate?: string,
  admissionTime?: string
): string | undefined => {
  if (!admissionDate) {
    return undefined;
  }

  if (!admissionTime) {
    return admissionDate;
  }

  return resolveClinicalDayForDateTime(admissionDate, admissionTime);
};
