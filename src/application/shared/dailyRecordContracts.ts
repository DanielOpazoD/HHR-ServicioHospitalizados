/**
 * Application-facing daily record contracts.
 *
 * Keep application and UI-adjacent code importing from here instead of the root
 * `types/domain/dailyRecord` contract so the persistence shape can keep
 * shrinking behind contextual contracts over time.
 *
 * This file remains as a temporary compatibility aggregator while imports move
 * to slice-specific contracts.
 *
 * @deprecated Prefer importing from the slice-specific modules:
 * `dailyRecordCoreContracts`, `dailyRecordBedContracts`,
 * `dailyRecordStaffContracts`, or `dailyRecordMedicalContracts`.
 */
export type {
  DailyRecord,
  DailyRecordDateRef,
  DailyRecordPatch,
} from '@/application/shared/dailyRecordCoreContracts';
export type {
  DailyRecordBedAuditState,
  DailyRecordBedLayoutState,
  DailyRecordBedsState,
  DailyRecordCriticalValidationState,
} from '@/application/shared/dailyRecordBedContracts';
export type {
  DailyRecordCudyrExportState,
  DailyRecordStaffingState,
} from '@/application/shared/dailyRecordStaffContracts';
export type {
  DailyRecordMedicalMessagingState,
  MedicalHandoffActor,
  MedicalHandoffBySpecialty,
  MedicalSpecialty,
  MedicalSpecialtyHandoffNote,
} from '@/application/shared/dailyRecordMedicalContracts';
