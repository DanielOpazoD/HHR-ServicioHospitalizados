import type { DailyRecord } from '@/types/domain/dailyRecord';

export type CensusExportRecord = Pick<
  DailyRecord,
  | 'date'
  | 'beds'
  | 'bedTypeOverrides'
  | 'lastUpdated'
  | 'activeExtraBeds'
  | 'discharges'
  | 'transfers'
  | 'cma'
  | 'nurses'
  | 'nurseName'
  | 'nursesDayShift'
  | 'nursesNightShift'
>;
