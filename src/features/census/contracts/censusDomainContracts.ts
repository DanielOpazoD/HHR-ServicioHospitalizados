import type {
  DailyRecord as RootDailyRecord,
  DailyRecordPatch as RootDailyRecordPatch,
} from '@/types/domain/dailyRecord';
import type {
  CesareanLabor as RootCesareanLabor,
  DeliveryRoute as RootDeliveryRoute,
  GinecobstetriciaType as RootGinecobstetriciaType,
  PatientData as RootPatientData,
} from '@/types/domain/patient';

export type DailyRecord = RootDailyRecord;
export type DailyRecordPatch = RootDailyRecordPatch;
export type PatientData = RootPatientData;
export type DeliveryRoute = RootDeliveryRoute;
export type CesareanLabor = RootCesareanLabor;
export type GinecobstetriciaType = RootGinecobstetriciaType;
