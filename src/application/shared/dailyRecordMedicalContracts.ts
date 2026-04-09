import type {
  MedicalHandoffBySpecialty as RootMedicalHandoffBySpecialty,
  MedicalHandoffActor as RootMedicalHandoffActor,
  MedicalSpecialty as RootMedicalSpecialty,
  MedicalSpecialtyHandoffNote as RootMedicalSpecialtyHandoffNote,
} from '@/types/domain/dailyRecordMedicalHandoff';
import type { DailyRecordMedicalMessagingState as RootDailyRecordMedicalMessagingState } from '@/types/domain/dailyRecordSlices';

/**
 * Medical/handoff-facing slices of the daily record contract.
 */
export type MedicalHandoffActor = RootMedicalHandoffActor;
export type MedicalSpecialty = RootMedicalSpecialty;
export type MedicalHandoffBySpecialty = RootMedicalHandoffBySpecialty;
export type MedicalSpecialtyHandoffNote = RootMedicalSpecialtyHandoffNote;
export type DailyRecordMedicalMessagingState = RootDailyRecordMedicalMessagingState;
