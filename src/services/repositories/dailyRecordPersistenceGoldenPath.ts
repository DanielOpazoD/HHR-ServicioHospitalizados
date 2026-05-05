import type { DailyRecord } from '@/types/domain/dailyRecord';
import { resolveDailyRecordReadConsistency } from '@/services/repositories/dailyRecordConsistencyPolicy';
import {
  shouldKeepLocalRecordOverRemote,
  resolvePreferredDailyRecord,
} from '@/services/repositories/dailyRecordSyncCompatibility';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';

export type DailyRecordRemoteAvailability =
  | 'resolved'
  | 'missing'
  | 'unavailable'
  | 'not_requested';

interface ResolveDailyRecordPersistenceGoldenPathInput {
  localRecord: DailyRecord | null;
  remoteRecord: DailyRecord | null;
  remoteAvailability: DailyRecordRemoteAvailability;
  localRepairApplied?: boolean;
  remoteRepairApplied?: boolean;
}

export interface DailyRecordPersistenceGoldenPathResult {
  selectedRecord: DailyRecord | null;
  selectedStore: 'local' | 'remote' | 'none';
  shouldHydrateLocal: boolean;
  consistencyState: ReturnType<typeof resolveDailyRecordReadConsistency>['consistencyState'];
  sourceOfTruth: ReturnType<typeof resolveDailyRecordReadConsistency>['sourceOfTruth'];
  retryability: ReturnType<typeof resolveDailyRecordReadConsistency>['retryability'];
  recoveryAction: ReturnType<typeof resolveDailyRecordReadConsistency>['recoveryAction'];
  conflictSummary: ReturnType<typeof resolveDailyRecordReadConsistency>['conflictSummary'];
  observabilityTags: ReturnType<typeof resolveDailyRecordReadConsistency>['observabilityTags'];
  userSafeMessage: ReturnType<typeof resolveDailyRecordReadConsistency>['userSafeMessage'];
  repairApplied: boolean;
}

export const resolveDailyRecordPersistenceGoldenPath = ({
  localRecord,
  remoteRecord,
  remoteAvailability,
  localRepairApplied = false,
  remoteRepairApplied = false,
}: ResolveDailyRecordPersistenceGoldenPathInput): DailyRecordPersistenceGoldenPathResult => {
  const selectedRecord =
    remoteAvailability === 'not_requested'
      ? localRecord
      : localRecord && remoteRecord && shouldKeepLocalRecordOverRemote(localRecord, remoteRecord)
        ? resolveDailyRecordConflict(remoteRecord, localRecord)
        : resolvePreferredDailyRecord(localRecord, remoteRecord);
  const selectedStore = !selectedRecord
    ? 'none'
    : remoteRecord && (!localRecord || !shouldKeepLocalRecordOverRemote(localRecord, remoteRecord))
      ? 'remote'
      : 'local';
  const repairApplied =
    selectedStore === 'remote'
      ? remoteRepairApplied
      : selectedStore === 'local'
        ? localRepairApplied
        : false;
  const consistency = resolveDailyRecordReadConsistency({
    localRecord,
    remoteRecord,
    selectedRecord,
    remoteAvailability,
    repairApplied,
  });

  return {
    selectedRecord,
    selectedStore,
    shouldHydrateLocal: consistency.shouldHydrateLocal,
    consistencyState: consistency.consistencyState,
    sourceOfTruth: consistency.sourceOfTruth,
    retryability: consistency.retryability,
    recoveryAction: consistency.recoveryAction,
    conflictSummary: consistency.conflictSummary,
    observabilityTags: consistency.observabilityTags,
    userSafeMessage: consistency.userSafeMessage,
    repairApplied: consistency.repairApplied,
  };
};
