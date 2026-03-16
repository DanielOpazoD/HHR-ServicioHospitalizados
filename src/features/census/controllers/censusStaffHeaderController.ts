import type { DischargeData, TransferData } from '@/types/domain/movements';
import type { PatientData } from '@/types/domain/patient';
import { classifyPatientMovementForRecord } from '@/application/patient-flow/clinicalEpisode';

export interface StaffSelectorsState {
  nursesDayShift: string[];
  nursesNightShift: string[];
  tensDayShift: string[];
  tensNightShift: string[];
}

export interface MovementSummaryState {
  discharges: DischargeData[];
  transfers: TransferData[];
  cmaCount: number;
  admissionsCount: number;
}

interface StaffInput {
  nursesDayShift?: string[] | null;
  nursesNightShift?: string[] | null;
  tensDayShift?: string[] | null;
  tensNightShift?: string[] | null;
}

interface MovementsInput {
  discharges?: DischargeData[] | null;
  transfers?: TransferData[] | null;
  cma?: Array<{ id: string }> | null;
  admissionsCount?: number | null;
}

interface AdmissionsInput {
  beds?: Record<string, PatientData> | null;
  recordDate?: string;
}

const ensureStringArray = (value?: string[] | null): string[] =>
  Array.isArray(value) ? value : [];

export const resolveStaffSelectorsState = (input?: StaffInput | null): StaffSelectorsState => ({
  nursesDayShift: ensureStringArray(input?.nursesDayShift),
  nursesNightShift: ensureStringArray(input?.nursesNightShift),
  tensDayShift: ensureStringArray(input?.tensDayShift),
  tensNightShift: ensureStringArray(input?.tensNightShift),
});

export const resolveMovementSummaryState = (
  input?: MovementsInput | null
): MovementSummaryState => ({
  discharges: input?.discharges || [],
  transfers: input?.transfers || [],
  cmaCount: input?.cma?.length || 0,
  admissionsCount: Math.max(0, input?.admissionsCount || 0),
});

const collectHospitalizedPatients = (beds?: Record<string, PatientData> | null): PatientData[] => {
  if (!beds) return [];

  const patients: PatientData[] = [];
  Object.values(beds).forEach(patient => {
    if (patient?.patientName?.trim() && !patient?.isBlocked) {
      patients.push(patient);
    }

    if (patient?.clinicalCrib?.patientName?.trim() && !patient.clinicalCrib?.isBlocked) {
      patients.push(patient.clinicalCrib);
    }
  });

  return patients;
};

export const collectHospitalizedPatientsForRecord = collectHospitalizedPatients;

export const resolveAdmissionsCountForRecord = ({ beds, recordDate }: AdmissionsInput): number => {
  if (!recordDate) return 0;

  const patients = collectHospitalizedPatients(beds);
  return patients.filter(
    patient => classifyPatientMovementForRecord(recordDate, patient).isNewAdmission
  ).length;
};

export const resolveStaffSelectorsClassName = (readOnly: boolean): string =>
  readOnly ? 'pointer-events-none opacity-80' : '';
