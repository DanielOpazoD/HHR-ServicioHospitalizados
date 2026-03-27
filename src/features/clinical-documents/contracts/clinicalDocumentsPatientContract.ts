import type { PatientEpisodeContract } from '@/application/patient-flow/clinicalEpisodeContracts';

export interface ClinicalDocumentsWorkspacePatientContract extends PatientEpisodeContract {
  patientName?: string;
  rut?: string;
  age?: string;
  birthDate?: string;
  admissionDate?: string;
}

export type PatientData = ClinicalDocumentsWorkspacePatientContract;
