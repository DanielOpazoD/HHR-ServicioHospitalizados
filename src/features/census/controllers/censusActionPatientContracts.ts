import type { PatientData as RootPatientData } from '@/features/census/contracts/censusPatientContracts';

export type CensusActionPatientContract = RootPatientData;
export type CensusActionPatient = CensusActionPatientContract;
export type PatientData = CensusActionPatientContract;
