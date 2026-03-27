import type {
  CesareanLabor as RootCesareanLabor,
  DeliveryRoute as RootDeliveryRoute,
  GinecobstetriciaType as RootGinecobstetriciaType,
  PatientData as RootPatientData,
} from '@/features/census/contracts/censusDomainContracts';

export type PatientRowPatientContract = RootPatientData;
export type PatientData = PatientRowPatientContract;
export type DeliveryRoute = RootDeliveryRoute;
export type CesareanLabor = RootCesareanLabor;
export type GinecobstetriciaType = RootGinecobstetriciaType;
export type PatientRowPatientPatch = Partial<PatientRowPatientContract>;
