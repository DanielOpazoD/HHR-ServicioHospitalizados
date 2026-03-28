/**
 * @deprecated Compatibility facade only.
 *
 * New source code in the census feature should import from:
 * `@/features/census/contracts/censusRecordContracts` or
 * `@/features/census/contracts/censusObstetricContracts` or
 * `@/features/census/contracts/censusObstetricContracts`.
 */

export type {
  DailyRecord,
  DailyRecordPatch,
} from '@/features/census/contracts/censusRecordContracts';
export type { PatientData } from '@/features/census/contracts/censusPatientContracts';
export type {
  DeliveryRoute,
  CesareanLabor,
  GinecobstetriciaType,
} from '@/features/census/contracts/censusObstetricContracts';
