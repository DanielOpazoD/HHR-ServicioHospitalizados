import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import {
  saveRecordToFirestore,
  updateRecordPartial as updateRecordPartialToFirestore,
} from '@/services/storage/firestore/firestoreRecordWrites';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import {
  createPartialUpdateDailyRecordCommand,
  createSaveDailyRecordCommand,
} from '@/services/repositories/contracts/dailyRecordCommands';
import { createUpdatePartialDailyRecordResult } from '@/services/repositories/contracts/dailyRecordResults';
import { prepareDailyRecordForPersistence } from '@/services/repositories/dailyRecordPersistencePreparation';
import { preparePatchedRecordForPersistence } from '@/services/repositories/dailyRecordPatchPreparation';
import {
  assertRemoteSaveCompatibility,
  resolveRemoteWriteRecovery,
} from '@/services/repositories/dailyRecordRemoteWriteController';
import { syncPatientsToMasterInBackground } from '@/services/repositories/dailyRecordBackgroundMasterSyncController';
import {
  applyRecoveryDecisionToState,
  buildBlockedPartialUpdateResult,
  buildBlockedSaveResult,
  buildPartialUpdateResult,
  buildSaveResult,
  createRemoteWriteState,
  type RemoteWriteState,
} from '@/services/repositories/dailyRecordWriteState';
import { dailyRecordWriteLogger } from '@/services/repositories/repositoryLoggers';
import { DataRegressionError, VersionMismatchError } from '@/utils/integrityGuard';
import { AdmissionDatePolicyViolationError } from '@/application/patient-flow/admissionDatePolicy';

// Field shrinkage telemetry — observability only, no behavior change.
// Catches the family of bugs where a stale snapshot or a debounced commit
// overwrites a longer text field with a much shorter one. The 20-char
// floor avoids noise on short fields ("OK" -> "O" is not interesting);
// the 50% threshold catches paste-over and stale-snapshot replacements
// while letting normal edits through.
const FIELD_SHRINKAGE_MIN_PREV_LENGTH = 20;
const FIELD_SHRINKAGE_RATIO_THRESHOLD = 0.5;

const resolvePathOnRecord = (record: DailyRecord, path: string): unknown => {
  const segments = path.split('.');
  let current: unknown = record;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const reportFieldShrinkage = (
  date: string,
  current: DailyRecord,
  patches: DailyRecordPatch
): void => {
  for (const [path, nextValue] of Object.entries(patches)) {
    if (typeof nextValue !== 'string' || nextValue.length === 0) continue;
    const prevValue = resolvePathOnRecord(current, path);
    if (typeof prevValue !== 'string') continue;
    if (prevValue.length < FIELD_SHRINKAGE_MIN_PREV_LENGTH) continue;
    if (nextValue.length / prevValue.length >= FIELD_SHRINKAGE_RATIO_THRESHOLD) continue;
    dailyRecordWriteLogger.warn(
      `Field shrinkage detected at ${path} for ${date}: ${prevValue.length} -> ${nextValue.length} chars`,
      { path, date, prevLength: prevValue.length, nextLength: nextValue.length }
    );
  }
};

const runRemoteSaveIntegrityCheck = async (date: string, record: DailyRecord): Promise<void> => {
  if (!isFirestoreEnabled()) return;

  try {
    await assertRemoteSaveCompatibility(date, record);
  } catch (err) {
    if (
      err instanceof Error &&
      (err.name === 'DataRegressionError' || err.name === 'VersionMismatchError')
    ) {
      throw err;
    }
    dailyRecordWriteLogger.warn('Could not perform integrity check, proceeding anyway', err);
  }
};

const applyRemoteRecovery = async (
  date: string,
  record: DailyRecord,
  fields: string[],
  error: unknown,
  state: RemoteWriteState
): Promise<'continue' | 'return'> => {
  const recovery = await resolveRemoteWriteRecovery(date, record, fields, error);
  if (recovery.status === 'throw') {
    applyRecoveryDecisionToState(
      state,
      recovery.decision,
      recovery.error instanceof Error ? recovery.error : undefined
    );
    return 'return';
  }

  state.queuedForRetry = recovery.queuedForRetry;
  state.autoMerged = recovery.autoMerged;
  applyRecoveryDecisionToState(state, recovery.decision);
  return recovery.status === 'auto_merged' ? 'return' : 'continue';
};

const markRemoteWriteSucceeded = (state: RemoteWriteState): void => {
  state.savedRemotely = true;
  state.consistencyState = 'persisted_and_synced';
  state.recoveryAction = 'none';
  state.retryability = 'not_applicable';
  state.observabilityTags = ['daily_record', 'write', 'persisted_and_synced'];
};

const persistLocalAndAttemptRemoteSync = async ({
  date,
  record,
  changedPaths,
  remoteState,
  remoteWrite,
  onRemoteFailure,
}: {
  date: string;
  record: DailyRecord;
  changedPaths: string[];
  remoteState: RemoteWriteState;
  remoteWrite: () => Promise<void>;
  onRemoteFailure: (error: unknown) => void;
}): Promise<'continue' | 'return'> => {
  await saveToIndexedDB(record);

  if (!isFirestoreEnabled()) {
    return 'continue';
  }

  try {
    await remoteWrite();
    markRemoteWriteSucceeded(remoteState);
    return 'continue';
  } catch (err) {
    onRemoteFailure(err);
    return applyRemoteRecovery(date, record, changedPaths, err, remoteState);
  }
};

export const saveDetailed = async (record: DailyRecord, expectedLastUpdated?: string) => {
  const command = createSaveDailyRecordCommand(record, expectedLastUpdated);
  const remoteState = createRemoteWriteState();
  let validatedRecord: DailyRecord;
  try {
    const currentLocalRecord = await getRecordFromIndexedDB(command.date);
    validatedRecord = prepareDailyRecordForPersistence(
      command.record,
      command.date,
      currentLocalRecord
    );
    await runRemoteSaveIntegrityCheck(command.date, validatedRecord);
  } catch (err) {
    if (
      err instanceof DataRegressionError ||
      err instanceof VersionMismatchError ||
      err instanceof AdmissionDatePolicyViolationError
    ) {
      applyRecoveryDecisionToState(
        remoteState,
        {
          consistencyState:
            err instanceof DataRegressionError
              ? 'blocked_regression'
              : err instanceof VersionMismatchError
                ? 'blocked_version_mismatch'
                : 'blocked_validation',
          retryability: 'blocked',
          recoveryAction: 'block_and_surface',
          blockingReason:
            err instanceof DataRegressionError
              ? 'regression'
              : err instanceof VersionMismatchError
                ? 'version_mismatch'
                : 'validation',
          conflictSummary: {
            kind:
              err instanceof DataRegressionError
                ? 'regression_blocked'
                : err instanceof VersionMismatchError
                  ? 'version_mismatch'
                  : 'validation_blocked',
            sourceOfTruth: 'none',
            message: err.message,
          },
          observabilityTags: [
            'daily_record',
            'write',
            err instanceof DataRegressionError
              ? 'regression_blocked'
              : err instanceof VersionMismatchError
                ? 'version_mismatch'
                : 'validation_blocked',
          ],
          userSafeMessage: err.message,
        },
        err
      );
      return buildBlockedSaveResult(command.date, remoteState);
    }
    throw err;
  }

  const nextAction = await persistLocalAndAttemptRemoteSync({
    date: command.date,
    record: validatedRecord,
    changedPaths: ['*'],
    remoteState,
    remoteWrite: () => saveRecordToFirestore(validatedRecord, command.expectedLastUpdated),
    onRemoteFailure: err => {
      dailyRecordWriteLogger.warn(
        `Firestore sync failed for ${command.date}; data persisted in IndexedDB`,
        err
      );
    },
  });
  if (nextAction === 'return') {
    return buildSaveResult(command.date, remoteState);
  }

  syncPatientsToMasterInBackground(validatedRecord);

  return buildSaveResult(command.date, remoteState);
};

export const save = async (record: DailyRecord, expectedLastUpdated?: string): Promise<void> => {
  const result = await saveDetailed(record, expectedLastUpdated);
  if (result.blockingError) {
    throw result.blockingError;
  }
};

export const updatePartialDetailed = async (date: string, partialData: DailyRecordPatch) => {
  const command = createPartialUpdateDailyRecordCommand(date, partialData);
  const remoteState = createRemoteWriteState();
  const current = await getRecordFromIndexedDB(command.date);

  if (!current) {
    dailyRecordWriteLogger.warn(`No record found for ${command.date}; partial update aborted`);
    return createUpdatePartialDailyRecordResult({
      date: command.date,
      outcome: 'blocked',
      savedLocally: false,
      updatedRemotely: false,
      queuedForRetry: false,
      autoMerged: false,
      patchedFields: Object.keys(command.patch).length,
      consistencyState: 'unrecoverable',
      sourceOfTruth: 'none',
      retryability: 'manual_review',
      recoveryAction: 'block_and_surface',
      conflictSummary: {
        kind: 'remote_missing',
        sourceOfTruth: 'none',
        message: 'No se encontró un registro local válido para aplicar el cambio.',
      },
      observabilityTags: ['daily_record', 'write', 'missing_local_record'],
      userSafeMessage: 'No se encontró un registro local válido para aplicar el cambio.',
      repairApplied: false,
    });
  }

  let validatedRecord: DailyRecord;
  let mergedPatches: DailyRecordPatch;
  try {
    ({ record: validatedRecord, mergedPatches } = preparePatchedRecordForPersistence(
      current,
      command.date,
      command.patch
    ));
  } catch (err) {
    if (err instanceof AdmissionDatePolicyViolationError) {
      applyRecoveryDecisionToState(
        remoteState,
        {
          consistencyState: 'blocked_validation',
          retryability: 'blocked',
          recoveryAction: 'block_and_surface',
          blockingReason: 'validation',
          conflictSummary: {
            kind: 'validation_blocked',
            sourceOfTruth: 'none',
            changedPaths: Object.keys(command.patch),
            message: err.message,
          },
          observabilityTags: ['daily_record', 'write', 'validation_blocked'],
          userSafeMessage: err.message,
        },
        err
      );
      return buildBlockedPartialUpdateResult(
        command.date,
        remoteState,
        Object.keys(command.patch).length
      );
    }
    throw err;
  }
  const patchedFields = Object.keys(mergedPatches).length;

  reportFieldShrinkage(command.date, current, mergedPatches);

  const nextAction = await persistLocalAndAttemptRemoteSync({
    date: command.date,
    record: validatedRecord,
    changedPaths: Object.keys(mergedPatches),
    remoteState,
    remoteWrite: () =>
      updateRecordPartialToFirestore(command.date, mergedPatches, current.lastUpdated),
    onRemoteFailure: err => {
      dailyRecordWriteLogger.warn(`Firestore partial update failed for ${command.date}`, err);
    },
  });
  if (nextAction === 'return') {
    return buildPartialUpdateResult(command.date, remoteState, patchedFields);
  }

  return buildPartialUpdateResult(command.date, remoteState, patchedFields);
};

export const updatePartial = async (date: string, partialData: DailyRecordPatch): Promise<void> => {
  const result = await updatePartialDetailed(date, partialData);
  if (result.blockingError) {
    throw result.blockingError;
  }
};
