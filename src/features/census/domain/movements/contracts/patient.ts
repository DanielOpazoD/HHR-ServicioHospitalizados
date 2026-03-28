import type { PatientData as RootPatientData } from '@/features/census/contracts/censusPatientContracts';

export type MovementPatientContract = RootPatientData;
export type MovementPatientSnapshot = MovementPatientContract;
export type MovementPatientFactory = (bedId: string) => MovementPatientContract;
export type PatientData = MovementPatientContract;
