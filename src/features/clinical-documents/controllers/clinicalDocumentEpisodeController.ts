import type { ClinicalDocumentEpisodeContext } from '@/features/clinical-documents/domain/entities';
import type { PatientData } from '@/features/clinical-documents/contracts/clinicalDocumentsPatientContract';
import {
  buildClinicalEpisodeKey as buildClinicalEpisodeKeyFromApplication,
  resolveClinicalEpisode,
} from '@/application/patient-flow/clinicalEpisode';
import { calculateAge } from '@/utils/clinicalUtils';

export const buildClinicalEpisodeKey = (patientRut: string, admissionDate?: string): string =>
  buildClinicalEpisodeKeyFromApplication(patientRut, admissionDate);

const padTime = (value: number): string => value.toString().padStart(2, '0');

export const getCurrentDateValue = (): string => new Date().toISOString().slice(0, 10);

export const getCurrentTimeValue = (): string => {
  const date = new Date();
  return `${padTime(date.getHours())}:${padTime(date.getMinutes())}`;
};

export const buildClinicalDocumentEpisodeContext = (
  patient: PatientData,
  sourceDailyRecordDate: string,
  sourceBedId: string
): ClinicalDocumentEpisodeContext =>
  resolveClinicalEpisode(patient, {
    sourceDailyRecordDate,
    sourceBedId,
  });

export const buildClinicalDocumentPatientFieldValues = (
  patient: PatientData
): Record<string, string> => ({
  nombre: patient.patientName || '',
  rut: patient.rut || '',
  edad: patient.age || calculateAge(patient.birthDate),
  fecnac: patient.birthDate || '',
  fing: patient.admissionDate || '',
  finf: getCurrentDateValue(),
  hinf: getCurrentTimeValue(),
});
