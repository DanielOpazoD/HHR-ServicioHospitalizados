import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { ConflictAutoMergeRecoveryResult } from '@/services/repositories/contracts/dailyRecordWriteRecoveryResult';
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';
import { resolveDailyRecordConflictWithTrace } from '@/services/repositories/conflictResolutionMatrix';
import { buildConflictAuditSummary } from '@/services/repositories/conflictResolutionAuditSummary';
import { logRepositoryConflictAutoMerged } from '@/services/repositories/ports/repositoryAuditPort';
import { dailyRecordWriteSupportLogger } from '@/services/repositories/repositoryLoggers';
import {
  buildRecoveryTaskMeta,
  resolveEffectiveChangedPaths,
} from '@/services/repositories/dailyRecordWriteRecoveryController';
import { queueSyncTask } from '@/services/storage/sync';

const queueMergedRecoveryTask = async (record: DailyRecord, changedPaths: string[]) => {
  const result = await queueSyncTask(
    'UPDATE_DAILY_RECORD',
    record,
    buildRecoveryTaskMeta(changedPaths, 'conflict_auto_merge')
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

    const { record: merged, trace } = resolveDailyRecordConflictWithTrace(
      remoteRecord,
      localRecord,
      {
        changedPaths: effectiveChangedPaths,
      }
    );

    const auditDetails = buildConflictAuditSummary(
      effectiveChangedPaths,
      trace.policyVersion,
      trace.entries
    );

    await saveToIndexedDB(merged);
    const queued = await queueMergedRecoveryTask(merged, changedPaths);
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
