import { DailyRecord, DailyRecordPatch } from '@/types';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexedDBService';
import { queueSyncTask } from '@/services/storage/syncQueueService';
import {
  getRecordFromFirestore,
  saveRecordToFirestore,
  updateRecordPartial as updateRecordPartialToFirestore,
} from '@/services/storage/firestoreService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { DataRegressionError, VersionMismatchError } from '@/utils/integrityGuard';
import { resolveDailyRecordConflictWithTrace } from '@/services/repositories/conflictResolutionMatrix';
import { buildConflictAuditSummary } from '@/services/repositories/conflictResolutionAuditSummary';
import { logRepositoryConflictAutoMerged } from '@/services/repositories/ports/repositoryAuditPort';
import {
  createPartialUpdateDailyRecordCommand,
  createSaveDailyRecordCommand,
} from '@/services/repositories/contracts/dailyRecordCommands';
import {
  createSaveDailyRecordResult,
  createUpdatePartialDailyRecordResult,
} from '@/services/repositories/contracts/dailyRecordResults';
import {
  assertRemoteSaveCompatibility,
  prepareDailyRecordForPersistence,
  preparePatchedRecordForPersistence,
  queueRetryForRecord,
  shouldQueueRetryableError,
  syncPatientsToMasterInBackground,
} from '@/services/repositories/dailyRecordWriteSupport';

const isConcurrencyError = (error: unknown): boolean =>
  error instanceof Error && error.name === 'ConcurrencyError';

const autoMergeAndQueueConflict = async (
  date: string,
  localRecord: DailyRecord,
  changedPaths: string[]
): Promise<boolean> => {
  try {
    const remoteRecord = await getRecordFromFirestore(date);
    if (!remoteRecord) {
      return false;
    }

    const { record: merged, trace } = resolveDailyRecordConflictWithTrace(
      remoteRecord,
      localRecord,
      {
        changedPaths: changedPaths.length > 0 ? changedPaths : ['*'],
      }
    );

    const auditDetails = buildConflictAuditSummary(
      changedPaths.length > 0 ? changedPaths : ['*'],
      trace.policyVersion,
      trace.entries
    );

    await saveToIndexedDB(merged);
    await queueSyncTask('UPDATE_DAILY_RECORD', merged);
    await logRepositoryConflictAutoMerged(date, auditDetails);
    return true;
  } catch (mergeError) {
    console.warn('[Repository] Auto-merge conflict fallback failed:', mergeError);
    return false;
  }
};

export const save = async (record: DailyRecord, expectedLastUpdated?: string): Promise<void> => {
  const command = createSaveDailyRecordCommand(record, expectedLastUpdated);
  let savedRemotely = false;
  let queuedForRetry = false;
  let autoMerged = false;

  const validatedRecord = prepareDailyRecordForPersistence(command.record, command.date);

  if (isFirestoreEnabled()) {
    try {
      await assertRemoteSaveCompatibility(command.date, validatedRecord);
    } catch (err) {
      if (err instanceof DataRegressionError || err instanceof VersionMismatchError) throw err;
      console.warn('[Repository] Could not perform integrity check, proceeding:', err);
    }
  }

  await saveToIndexedDB(validatedRecord);

  if (isFirestoreEnabled()) {
    try {
      await saveRecordToFirestore(validatedRecord, command.expectedLastUpdated);
    } catch (err) {
      console.warn('Firestore sync failed, data saved in IndexedDB:', err);
      if (err instanceof Error && (isConcurrencyError(err) || err instanceof DataRegressionError)) {
        if (isConcurrencyError(err)) {
          const merged = await autoMergeAndQueueConflict(command.date, validatedRecord, ['*']);
          if (merged) {
            autoMerged = true;
            createSaveDailyRecordResult({
              date: command.date,
              savedLocally: true,
              savedRemotely: false,
              queuedForRetry: true,
              autoMerged,
            });
            return;
          }
        }
        throw err;
      }

      if (shouldQueueRetryableError(err)) {
        queuedForRetry = await queueRetryForRecord(validatedRecord);
      }
    }
    if (!queuedForRetry && !autoMerged) {
      savedRemotely = true;
    }
  }

  syncPatientsToMasterInBackground(validatedRecord);

  createSaveDailyRecordResult({
    date: command.date,
    savedLocally: true,
    savedRemotely,
    queuedForRetry,
    autoMerged,
  });
};

export const updatePartial = async (date: string, partialData: DailyRecordPatch): Promise<void> => {
  const command = createPartialUpdateDailyRecordCommand(date, partialData);
  let updatedRemotely = false;
  let queuedForRetry = false;
  let autoMerged = false;

  const current = await getRecordFromIndexedDB(command.date);

  if (!current) {
    console.warn(
      `[Repository] updatePartial: No record found for ${command.date}, operation aborted.`
    );
    return;
  }

  const { record: validatedRecord, mergedPatches } = preparePatchedRecordForPersistence(
    current,
    command.date,
    command.patch
  );

  await saveToIndexedDB(validatedRecord);

  if (isFirestoreEnabled()) {
    try {
      await updateRecordPartialToFirestore(command.date, mergedPatches);
      updatedRemotely = true;
    } catch (err) {
      console.warn('[Repository] Firestore partial update failed:', err);
      if (isConcurrencyError(err)) {
        await autoMergeAndQueueConflict(command.date, validatedRecord, Object.keys(mergedPatches));
        autoMerged = true;
        createUpdatePartialDailyRecordResult({
          date: command.date,
          savedLocally: true,
          updatedRemotely: false,
          queuedForRetry: true,
          autoMerged,
          patchedFields: Object.keys(mergedPatches).length,
        });
        return;
      }
      if (shouldQueueRetryableError(err)) {
        queuedForRetry = await queueRetryForRecord(validatedRecord);
      }
    }
  }

  createUpdatePartialDailyRecordResult({
    date: command.date,
    savedLocally: true,
    updatedRemotely,
    queuedForRetry,
    autoMerged,
    patchedFields: Object.keys(mergedPatches).length,
  });
};
