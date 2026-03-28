import type { DailyRecord } from '@/services/contracts/dailyRecordServiceContracts';

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
