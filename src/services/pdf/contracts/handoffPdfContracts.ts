import type { DailyRecordHandoffPdfState } from '@/types/domain/dailyRecordSlices';

export type HandoffPdfRecord = DailyRecordHandoffPdfState;

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
