import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { ConflictAutoMergeRecoveryResult } from '@/services/repositories/contracts/dailyRecordWriteRecoveryResult';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { resolveDailyRecordConflictWithTrace } from '@/services/repositories/conflictResolutionMatrix';
import { buildConflictAuditSummary } from '@/services/repositories/conflictResolutionAuditSummary';
import { logRepositoryConflictAutoMerged } from '@/services/repositories/ports/repositoryAuditPort';
import { dailyRecordWriteSupportLogger } from '@/services/repositories/repositoryLoggers';
import {
  buildRecoveryTaskMeta,
  resolveEffectiveChangedPaths,
} from '@/services/repositories/dailyRecordWriteRecoveryController';
import { queueDailyRecordSyncTaskWithLocalRecord } from '@/services/storage/sync';
import {
  buildConflictId,
  saveConflictVersionSnapshots,
} from '@/services/storage/firestore/dailyRecordConflictSnapshotService';

const queueMergedRecoveryTask = async (
  record: DailyRecord,
  changedPaths: string[],
  expectedVersion?: string
) => {
  const result = await queueDailyRecordSyncTaskWithLocalRecord(
    record,
    buildRecoveryTaskMeta(changedPaths, 'conflict_auto_merge', expectedVersion)
  );
  return result.accepted;
};

export const attemptConflictAutoMergeRecovery = async (
  date: string,
  localRecord: DailyRecord,
  changedPaths: string[]
): Promise<ConflictAutoMergeRecoveryResult> => {
  const effectiveChangedPaths = resolveEffectiveChangedPaths(changedPaths);

  try {
    const remoteRecord = await getRecordFromFirestore(date);
    if (!remoteRecord) {
      return { status: 'not_possible' };
    }

    // Capture both pre-merge versions (cloud + incoming) so an admin can later restore either.
    // Best-effort and placed before the merge so it covers every conflict path that reaches here
    // (auto-merge AND the unrecoverable block). See docs/ADR_CONFLICT_VERSION_RECOVERY.md.
    const conflictId = buildConflictId(date, remoteRecord, localRecord);
    await saveConflictVersionSnapshots(date, conflictId, {
      remote: remoteRecord,
      incoming: localRecord,
    });

    const { record: merged, trace } = resolveDailyRecordConflictWithTrace(
      remoteRecord,
      localRecord,
      {
        changedPaths: effectiveChangedPaths,
      }
    );

    const auditDetails = {
      ...buildConflictAuditSummary(effectiveChangedPaths, trace.policyVersion, trace.entries),
      conflictId,
    };

    const queued = await queueMergedRecoveryTask(merged, changedPaths, remoteRecord.lastUpdated);
    if (!queued) {
      return { status: 'not_possible' };
    }

    try {
      await logRepositoryConflictAutoMerged(date, auditDetails);
    } catch (auditError) {
      dailyRecordWriteSupportLogger.warn('Conflict auto-merge audit log failed', auditError);
    }

    return { status: 'auto_merged' };
  } catch (mergeError) {
    dailyRecordWriteSupportLogger.warn('Auto-merge conflict fallback failed', mergeError);
    return { status: 'not_possible' };
  }
};
