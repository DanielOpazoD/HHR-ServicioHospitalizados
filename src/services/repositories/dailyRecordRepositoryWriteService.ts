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
import { attemptConflictAutoMergeRecovery } from '@/services/repositories/dailyRecordConflictAutoMergeController';
import { syncPatientsToMasterInBackground } from '@/services/repositories/dailyRecordBackgroundMasterSyncController';
import { resolveBlockingFieldShrinkages } from '@/services/repositories/dailyRecordFieldShrinkageGuard';
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

const tryAutoMergeBlockedFullSaveRegression = async (
  date: string,
  record: DailyRecord,
  error: DataRegressionError,
  state: RemoteWriteState
): Promise<boolean> => {
  const mergeResult = await attemptConflictAutoMergeRecovery(date, record, ['*']);
  if (mergeResult?.status !== 'auto_merged') {
    return false;
  }

  state.queuedForRetry = true;
  state.autoMerged = true;
  applyRecoveryDecisionToState(state, {
    consistencyState: 'auto_merged',
    retryability: 'automatic_retry',
    recoveryAction: 'auto_merge_and_queue',
    conflictSummary: {
      kind: 'regression_blocked',
      sourceOfTruth: 'local',
      localTimestamp: record.lastUpdated,
      changedPaths: ['*'],
      message: error.message,
    },
    observabilityTags: ['daily_record', 'write', 'regression_auto_merged'],
    userSafeMessage:
      'Se detectó una posible pérdida de datos y se fusionó automáticamente con la copia remota.',
  });
  return true;
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
  const command = createSaveDailyRecordCommand(record, expectedLastUpdated ?? record.lastUpdated);
  const remoteState = createRemoteWriteState();
  let validatedRecord: DailyRecord = command.record;
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
      err instanceof DataRegressionError &&
      validatedRecord &&
      (await tryAutoMergeBlockedFullSaveRegression(command.date, validatedRecord, err, remoteState))
    ) {
      return buildSaveResult(command.date, remoteState);
    }

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

  const suspiciousShrinkages = await resolveBlockingFieldShrinkages(
    command.date,
    current,
    mergedPatches
  );
  if (suspiciousShrinkages.length > 0) {
    const firstShrinkage = suspiciousShrinkages[0];
    const error = new DataRegressionError(
      `Se bloqueó una reducción sospechosa de texto clínico (${firstShrinkage.prevLength} -> ${firstShrinkage.nextLength} caracteres). Recarga antes de reintentar para evitar pérdida de información.`,
      firstShrinkage.nextLength,
      firstShrinkage.prevLength
    );
    applyRecoveryDecisionToState(
      remoteState,
      {
        consistencyState: 'blocked_regression',
        retryability: 'blocked',
        recoveryAction: 'block_and_surface',
        blockingReason: 'regression',
        conflictSummary: {
          kind: 'regression_blocked',
          sourceOfTruth: 'none',
          changedPaths: suspiciousShrinkages.map(item => item.path),
          message: error.message,
        },
        observabilityTags: ['daily_record', 'write', 'field_shrinkage_blocked'],
        userSafeMessage: error.message,
      },
      error
    );
    return buildBlockedPartialUpdateResult(command.date, remoteState, patchedFields);
  }

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
