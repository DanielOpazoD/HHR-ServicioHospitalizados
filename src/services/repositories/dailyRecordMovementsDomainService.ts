import type { DailyRecordMovementCollectionsState } from '@/types/domain/dailyRecordSlices';

export interface EmptyDailyRecordMovements {
  discharges: DailyRecordMovementCollectionsState['discharges'];
  transfers: DailyRecordMovementCollectionsState['transfers'];
  cma: DailyRecordMovementCollectionsState['cma'];
}

export const createEmptyDailyRecordMovements = (): EmptyDailyRecordMovements => ({
  discharges: [],
  transfers: [],
  cma: [],
});
