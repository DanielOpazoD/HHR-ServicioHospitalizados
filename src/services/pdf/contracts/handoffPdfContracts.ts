import type { DailyRecord } from '@/types/domain/dailyRecord';

export type HandoffPdfRecord = Pick<
  DailyRecord,
  | 'date'
  | 'beds'
  | 'discharges'
  | 'transfers'
  | 'cma'
  | 'handoffDayChecklist'
  | 'handoffNightChecklist'
  | 'handoffNovedadesDayShift'
  | 'handoffNovedadesNightShift'
  | 'cudyrUpdatedAt'
  | 'cudyrLockedAt'
  | 'nurses'
  | 'nurseName'
  | 'nursesDayShift'
  | 'nursesNightShift'
  | 'tensDayShift'
  | 'tensNightShift'
  | 'handoffNightReceives'
>;

export type HandoffPdfStaffingRecord = Pick<
  HandoffPdfRecord,
  | 'nurses'
  | 'nurseName'
  | 'nursesDayShift'
  | 'nursesNightShift'
  | 'tensDayShift'
  | 'tensNightShift'
  | 'handoffNightReceives'
>;

export type HandoffPdfPatientTableRecord = Pick<HandoffPdfRecord, 'date' | 'beds'>;
export type HandoffPdfMovementsRecord = Pick<HandoffPdfRecord, 'discharges' | 'transfers' | 'cma'>;
export type HandoffPdfChecklistRecord = Pick<
  HandoffPdfRecord,
  'handoffDayChecklist' | 'handoffNightChecklist'
>;
export type HandoffPdfNovedadesRecord = Pick<
  HandoffPdfRecord,
  'handoffNovedadesDayShift' | 'handoffNovedadesNightShift'
>;
