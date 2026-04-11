import type { PatientEpisodeContract } from '@/application/patient-flow/clinicalEpisodeContracts';
import { isNewAdmissionForClinicalDay, normalizeDateOnly } from '@/utils/clinicalDayUtils';

export interface ClinicalEpisode {
  patientRut: string;
  patientName: string;
  admissionDate?: string;
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

export const buildClinicalEpisodeKey = (patientRut: string, admissionDate?: string): string =>
  `${patientRut || 'sin-rut'}__${admissionDate || 'sin-ingreso'}`;

/**
 * Clinical documents and episode snapshots should anchor to the first observed
 * day of the current episode when the census already resolved it.
 */
export const resolveClinicalEpisodeAdmissionDate = (
  patient: PatientEpisodeContract
): string | undefined => patient.firstSeenDate || patient.admissionDate;

export const resolveClinicalEpisode = (
  patient: PatientEpisodeContract,
  context?: {
    sourceDailyRecordDate?: string;
    sourceBedId?: string;
  }
): ClinicalEpisode => ({
  patientRut: patient.rut || '',
  patientName: patient.patientName || '',
  admissionDate: resolveClinicalEpisodeAdmissionDate(patient),
  sourceDailyRecordDate: context?.sourceDailyRecordDate,
  sourceBedId: context?.sourceBedId,
  specialty: patient.specialty,
  episodeKey: buildClinicalEpisodeKey(
    patient.rut || '',
    resolveClinicalEpisodeAdmissionDate(patient)
  ),
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
    episodeKey: buildClinicalEpisodeKey(patientRut, admissionDate),
  };
};

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

  if (normalizedRecordDate && normalizedFirstSeenDate) {
    return {
      isNewAdmission: normalizedRecordDate === normalizedFirstSeenDate,
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
