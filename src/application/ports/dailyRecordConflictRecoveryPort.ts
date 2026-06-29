import type { ConflictVersionSnapshot } from '@/services/storage/firestore/dailyRecordConflictSnapshotService';
import type { RestoreDailyRecordVersionResult } from '@/services/repositories/dailyRecordVersionRestoreController';

export type { ConflictVersionSnapshot } from '@/services/storage/firestore/dailyRecordConflictSnapshotService';
export type { RestoreDailyRecordVersionResult } from '@/services/repositories/dailyRecordVersionRestoreController';

/**
 * Boundary the census UI uses to list and restore daily-record conflict versions, so feature
 * components never reach into the storage/repository services directly. See
 * docs/ADR_CONFLICT_VERSION_RECOVERY.md.
 */
export interface DailyRecordConflictRecoveryPort {
  listConflictVersionSnapshots: (date: string) => Promise<ConflictVersionSnapshot[]>;
  restoreDailyRecordVersion: (
    date: string,
    snapshotId: string
  ) => Promise<RestoreDailyRecordVersionResult>;
}

export const defaultDailyRecordConflictRecoveryPort: DailyRecordConflictRecoveryPort = {
  listConflictVersionSnapshots: async date => {
    const { listConflictVersionSnapshots } =
      await import('@/services/storage/firestore/dailyRecordConflictSnapshotService');
    return listConflictVersionSnapshots(date);
  },
  restoreDailyRecordVersion: async (date, snapshotId) => {
    const { restoreDailyRecordVersion } =
      await import('@/services/repositories/dailyRecordVersionRestoreController');
    return restoreDailyRecordVersion(date, snapshotId);
  },
};
