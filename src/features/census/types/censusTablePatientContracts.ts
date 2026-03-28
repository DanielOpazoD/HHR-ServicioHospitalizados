import type { PatientData as RootPatientData } from '@/features/census/contracts/censusPatientContracts';

export type CensusTablePatientContract = RootPatientData;
export type CensusTablePatient = CensusTablePatientContract;
export type PatientData = CensusTablePatientContract;
