import { DataRegressionError, VersionMismatchError } from '@/utils/integrityGuard';
import type { DailyRecordConflictSummary } from '@/services/repositories/contracts/dailyRecordConsistency';
import type { RemoteWriteRecoveryResult } from '@/services/repositories/contracts/dailyRecordWriteRecoveryResult';
import { buildBlockedRecoveryResult } from '@/services/repositories/dailyRecordWriteRecoveryResultController';

type ConflictSummaryBuilder = (
  kind: DailyRecordConflictSummary['kind'],
  message: string
) => DailyRecordConflictSummary;

export const resolveBlockedRemoteWriteRecovery = (
  error: unknown,
  buildConflictSummary: ConflictSummaryBuilder
): RemoteWriteRecoveryResult | null => {
  if (!(error instanceof DataRegressionError || error instanceof VersionMismatchError)) {
    return null;
  }

  const blockingReason = error instanceof DataRegressionError ? 'regression' : 'version_mismatch';
  return buildBlockedRecoveryResult({
    error,
    blockingReason,
    conflictSummary: buildConflictSummary(
      blockingReason === 'regression' ? 'regression_blocked' : 'version_mismatch',
      error.message
    ),
    observabilityTags: [
      'daily_record',
      'write',
      blockingReason === 'regression' ? 'regression_blocked' : 'version_mismatch',
    ],
    userSafeMessage: error.message,
  });
};
