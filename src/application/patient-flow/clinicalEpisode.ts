import type { PatientData } from '@/types/domain/patient';
import { isNewAdmissionForClinicalDay } from '@/utils/dateUtils';

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

export const resolveClinicalEpisode = (
  patient: PatientData,
  context?: {
    sourceDailyRecordDate?: string;
    sourceBedId?: string;
  }
): ClinicalEpisode => ({
  patientRut: patient.rut || '',
  patientName: patient.patientName || '',
  admissionDate: patient.admissionDate,
  sourceDailyRecordDate: context?.sourceDailyRecordDate,
  sourceBedId: context?.sourceBedId,
  specialty: patient.specialty,
  episodeKey: buildClinicalEpisodeKey(patient.rut, patient.admissionDate),
});

export const buildPatientPresenceSnapshot = (
  patient: PatientData,
  bedId: string
): PatientPresenceSnapshot | null => {
  const patientRut = patient.rut?.trim();
  const admissionDate = patient.admissionDate?.trim();
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
    admissionDate?: string;
    admissionTime?: string;
  }
): PatientMovementClassification => ({
  isNewAdmission: isNewAdmissionForClinicalDay(
    recordDate,
    patient.admissionDate,
    patient.admissionTime
  ),
});
