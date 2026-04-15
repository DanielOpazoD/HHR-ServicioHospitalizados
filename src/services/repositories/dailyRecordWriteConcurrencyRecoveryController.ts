import { attemptConflictAutoMergeRecovery } from '@/services/repositories/dailyRecordConflictAutoMergeController';
import type { DailyRecordConflictSummary } from '@/services/repositories/contracts/dailyRecordConsistency';
import type { RemoteWriteRecoveryResult } from '@/services/repositories/contracts/dailyRecordWriteRecoveryResult';
import {
  buildAutoMergedRecoveryResult,
  buildThrowUnrecoverableRecoveryResult,
} from '@/services/repositories/dailyRecordWriteRecoveryResultController';
import type { DailyRecord } from '@/types/domain/dailyRecord';

type ConflictSummaryBuilder = (
  kind: DailyRecordConflictSummary['kind'],
  message: string
) => DailyRecordConflictSummary;

export const resolveConcurrencyRemoteWriteRecovery = async (
  date: string,
  record: DailyRecord,
  changedPaths: string[],
  error: unknown,
  buildConflictSummary: ConflictSummaryBuilder
): Promise<RemoteWriteRecoveryResult> => {
  const mergeResult = await attemptConflictAutoMergeRecovery(date, record, changedPaths);
  if (mergeResult.status === 'auto_merged') {
    return buildAutoMergedRecoveryResult(
      buildConflictSummary(
        'concurrency',
        'Se resolvió un conflicto remoto mediante fusión automática.'
      ),
      'Se resolvió un conflicto remoto mediante fusión automática.',
      ['daily_record', 'write', 'auto_merged']
    );
  }

  return buildThrowUnrecoverableRecoveryResult({
    error,
    conflictSummary: buildConflictSummary(
      'concurrency',
      'Se detectó un conflicto remoto que no pudo resolverse automáticamente.'
    ),
    observabilityTags: ['daily_record', 'write', 'conflict_unrecoverable'],
    userSafeMessage: 'Se detectó un conflicto remoto que requiere revisión manual.',
  });
};
