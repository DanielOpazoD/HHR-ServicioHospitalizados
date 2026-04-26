import type { SyncStatus } from '@/context/dailyRecordContextContracts';
import type { DailyRecordBootstrapPhase } from '@/hooks/controllers/dailyRecordBootstrapController';

export interface DailyRecordStatusModel {
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;
  bootstrapPhase: DailyRecordBootstrapPhase;
  isInitialRemoteHydrationPending: boolean;
  isSaving: boolean;
  hasError: boolean;
  isIdle: boolean;
  isSaved: boolean;
}

export interface BuildDailyRecordStatusModelInput {
  syncStatus: SyncStatus;
  lastSyncTime: Date | null;
  bootstrapPhase: DailyRecordBootstrapPhase;
}

export const buildDailyRecordStatusModel = ({
  syncStatus,
  lastSyncTime,
  bootstrapPhase,
}: BuildDailyRecordStatusModelInput): DailyRecordStatusModel => ({
  syncStatus,
  lastSyncTime,
  bootstrapPhase,
  isInitialRemoteHydrationPending: bootstrapPhase === 'remote_record_bootstrapping',
  isSaving: syncStatus === 'saving',
  hasError: syncStatus === 'error',
  isIdle: syncStatus === 'idle',
  isSaved: syncStatus === 'saved',
});
