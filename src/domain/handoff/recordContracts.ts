import type {
  DailyRecord as RootDailyRecord,
  DailyRecordPatch as RootDailyRecordPatch,
  MedicalHandoffActor as RootMedicalHandoffActor,
  MedicalSpecialty as RootMedicalSpecialty,
  MedicalHandoffBySpecialty,
  MedicalSpecialtyHandoffNote as RootMedicalSpecialtyHandoffNote,
} from '@/types/domain/dailyRecord';
import type { DischargeData, TransferData, CMAData } from '@/types/domain/movements';
import type { HandoffPatientContract } from '@/domain/handoff/patientContracts';

export type MedicalHandoffActor = RootMedicalHandoffActor;
export type MedicalSpecialty = RootMedicalSpecialty;
export type DailyRecordPatch = RootDailyRecordPatch;
export type MedicalSpecialtyHandoffNote = RootMedicalSpecialtyHandoffNote;

export interface HandoffDailyRecordContract {
  date: string;
  beds: Record<string, HandoffPatientContract>;
  discharges: DischargeData[];
  transfers: TransferData[];
  cma: CMAData[];
  lastUpdated: string;
  nursesDayShift?: string[];
  nursesNightShift?: string[];
  tensDayShift?: string[];
  tensNightShift?: string[];
  activeExtraBeds: string[];
  handoffDayChecklist?: RootDailyRecord['handoffDayChecklist'];
  handoffNightChecklist?: RootDailyRecord['handoffNightChecklist'];
  handoffNovedadesDayShift?: string;
  handoffNovedadesNightShift?: string;
  handoffNightReceives?: string[];
  medicalHandoffNovedades?: string;
  medicalHandoffBySpecialty?: MedicalHandoffBySpecialty;
  medicalHandoffDoctor?: string;
  medicalHandoffSentAt?: string;
  medicalHandoffSentAtByScope?: RootDailyRecord['medicalHandoffSentAtByScope'];
  medicalSignatureLinkTokenByScope?: RootDailyRecord['medicalSignatureLinkTokenByScope'];
  medicalSignature?: RootDailyRecord['medicalSignature'];
  medicalSignatureByScope?: RootDailyRecord['medicalSignatureByScope'];
}

export type DailyRecord = RootDailyRecord;
