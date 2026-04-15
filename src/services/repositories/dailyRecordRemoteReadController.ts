import { AdmissionDatePolicyViolationError } from '@/application/patient-flow/admissionDatePolicy';
import { persistHydratedRecordToLocalCache } from '@/services/repositories/dailyRecordLocalCachePersistence';
import { resolveDailyRecordPersistenceGoldenPath } from '@/services/repositories/dailyRecordPersistenceGoldenPath';
import {
  createGoldenPathReadResult,
  type LocalRuntimeReadCandidate,
} from '@/services/repositories/dailyRecordReadResultController';
import { dailyRecordReadLogger } from '@/services/repositories/repositoryLoggers';
import type { DailyRecordRemoteLoadResult } from '@/services/repositories/dailyRecordRemoteLoader';
import type { DailyRecordReadResult } from '@/services/repositories/contracts/dailyRecordQueries';
import type { DailyRecord } from '@/types/domain/dailyRecord';

interface ResolveRemoteGoldenPathReadResultInput {
  date: string;
  localCandidate: LocalRuntimeReadCandidate | null;
  remoteReadResult: DailyRecordRemoteLoadResult;
  persistHydratedRecord?: (
    record: DailyRecord,
    date: string,
    previousRecord?: DailyRecord | null
  ) => Promise<DailyRecord>;
}

export const resolveRemoteGoldenPathReadResult = async ({
  date,
  localCandidate,
  remoteReadResult,
  persistHydratedRecord = persistHydratedRecordToLocalCache,
}: ResolveRemoteGoldenPathReadResultInput): Promise<DailyRecordReadResult> => {
  const goldenPath = resolveDailyRecordPersistenceGoldenPath({
    localRecord: localCandidate?.record || null,
    remoteRecord: remoteReadResult.record,
    remoteAvailability: remoteReadResult.record ? 'resolved' : 'missing',
    localRepairApplied: localCandidate?.repairApplied || false,
    remoteRepairApplied:
      remoteReadResult.compatibilityIntensity !== 'none' ||
      remoteReadResult.migrationRulesApplied.length > 0,
  });

  if (goldenPath.shouldHydrateLocal && remoteReadResult.record) {
    try {
      await persistHydratedRecord(remoteReadResult.record, date, localCandidate?.record || null);
    } catch (error) {
      if (error instanceof AdmissionDatePolicyViolationError) {
        dailyRecordReadLogger.warn(
          `Skipped local hydration for ${date} due to admissionDate validation`,
          error
        );
      } else {
        throw error;
      }
    }
  }

  return createGoldenPathReadResult(date, goldenPath, localCandidate, remoteReadResult);
};
