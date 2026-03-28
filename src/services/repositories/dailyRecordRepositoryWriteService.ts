import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { DailyRecordPatch } from '@/types/domain/dailyRecordPatch';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexeddb/indexedDbRecordService';
import {
  saveRecordToFirestore,
  updateRecordPartial as updateRecordPartialToFirestore,
} from '@/services/storage/firestore';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
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
  resolveRemoteWriteRecovery,
  prepareDailyRecordForPersistence,
  preparePatchedRecordForPersistence,
  syncPatientsToMasterInBackground,
} from '@/services/repositories/dailyRecordWriteSupport';
import { dailyRecordWriteLogger } from '@/services/repositories/repositoryLoggers';
import type { DailyRecordRecoveryDecision } from '@/services/repositories/dailyRecordRecoveryPolicy';
import { DataRegressionError, VersionMismatchError } from '@/utils/integrityGuard';
import type { DailyRecordRetryability } from '@/services/repositories/contracts/dailyRecordConsistency';

interface RemoteWriteState {
  savedRemotely: boolean;
  queuedForRetry: boolean;
  autoMerged: boolean;
  consistencyState:
    | 'persisted_local_only'
    | 'persisted_and_synced'
    | 'queued_for_retry'
    | 'auto_merged'
    | 'blocked_regression'
    | 'blocked_version_mismatch'
    | 'unrecoverable';
  retryability: DailyRecordRetryability;
  recoveryAction:
    | 'none'
    | 'defer_remote_sync'
    | 'queue_retry'
    | 'auto_merge_and_queue'
    | 'block_and_surface';
  conflictSummary: DailyRecordRecoveryDecision['conflictSummary'];
  observabilityTags: string[];
  userSafeMessage?: string;
  blockingReason?: 'regression' | 'version_mismatch';
  blockingError?: Error;
}

const createRemoteWriteState = (): RemoteWriteState => ({
  savedRemotely: false,
  queuedForRetry: false,
  autoMerged: false,
  consistencyState: isFirestoreEnabled() ? 'persisted_local_only' : 'persisted_local_only',
  retryability: 'not_applicable',
  recoveryAction: isFirestoreEnabled() ? 'defer_remote_sync' : 'none',
  conflictSummary: null,
  observabilityTags: ['daily_record', 'write', isFirestoreEnabled() ? 'local_only' : 'local_only'],
});

const resolveWriteOutcome = (state: RemoteWriteState): 'clean' | 'queued' | 'auto_merged' => {
  if (state.autoMerged) {
    return 'auto_merged';
  }
  if (state.queuedForRetry) {
    return 'queued';
  }
  return 'clean';
};

const resolveCompatibilityOutcome = (
  state: RemoteWriteState
): 'clean' | 'queued' | 'auto_merged' | 'blocked' | 'unrecoverable' => {
  if (
    state.consistencyState === 'blocked_regression' ||
    state.consistencyState === 'blocked_version_mismatch'
  ) {
    return 'blocked';
  }

  if (state.consistencyState === 'unrecoverable') {
    return 'unrecoverable';
  }

  return resolveWriteOutcome(state);
};

const applyRecoveryDecisionToState = (
  state: RemoteWriteState,
  decision: DailyRecordRecoveryDecision,
  blockingError?: Error
): void => {
  state.consistencyState = decision.consistencyState;
  state.retryability = decision.retryability;
  state.recoveryAction = decision.recoveryAction;
  state.conflictSummary = decision.conflictSummary;
  state.observabilityTags = decision.observabilityTags;
  state.userSafeMessage = decision.userSafeMessage;
  state.blockingReason = decision.blockingReason;
  state.blockingError = blockingError;
};

const buildSaveResult = (date: string, state: RemoteWriteState) =>
  createSaveDailyRecordResult({
    date,
    outcome: resolveCompatibilityOutcome(state),
    savedLocally: true,
    savedRemotely: state.savedRemotely,
    queuedForRetry: state.queuedForRetry,
    autoMerged: state.autoMerged,
    consistencyState: state.consistencyState,
    sourceOfTruth: state.savedRemotely ? 'remote' : 'local',
    retryability: state.retryability,
    recoveryAction: state.recoveryAction,
    conflictSummary: state.conflictSummary,
    observabilityTags: state.observabilityTags,
    userSafeMessage: state.userSafeMessage,
    blockingReason: state.blockingReason,
    repairApplied: false,
    blockingError: state.blockingError,
  });

const buildPartialUpdateResult = (date: string, state: RemoteWriteState, patchedFields: number) =>
  createUpdatePartialDailyRecordResult({
    date,
    outcome: resolveCompatibilityOutcome(state),
    savedLocally: true,
    updatedRemotely: state.savedRemotely,
    queuedForRetry: state.queuedForRetry,
    autoMerged: state.autoMerged,
    patchedFields,
    consistencyState: state.consistencyState,
    sourceOfTruth: state.savedRemotely ? 'remote' : 'local',
    retryability: state.retryability,
    recoveryAction: state.recoveryAction,
    conflictSummary: state.conflictSummary,
    observabilityTags: state.observabilityTags,
    userSafeMessage: state.userSafeMessage,
    blockingReason: state.blockingReason,
    repairApplied: false,
    blockingError: state.blockingError,
  });

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

export const saveDetailed = async (record: DailyRecord, expectedLastUpdated?: string) => {
  const command = createSaveDailyRecordCommand(record, expectedLastUpdated);
  const remoteState = createRemoteWriteState();
  const validatedRecord = prepareDailyRecordForPersistence(command.record, command.date);
  try {
    await runRemoteSaveIntegrityCheck(command.date, validatedRecord);
  } catch (err) {
    if (err instanceof DataRegressionError || err instanceof VersionMismatchError) {
      applyRecoveryDecisionToState(
        remoteState,
        {
          consistencyState:
            err instanceof DataRegressionError ? 'blocked_regression' : 'blocked_version_mismatch',
          retryability: 'blocked',
          recoveryAction: 'block_and_surface',
          blockingReason: err instanceof DataRegressionError ? 'regression' : 'version_mismatch',
          conflictSummary: {
            kind: err instanceof DataRegressionError ? 'regression_blocked' : 'version_mismatch',
            sourceOfTruth: 'none',
            message: err.message,
          },
          observabilityTags: [
            'daily_record',
            'write',
            err instanceof DataRegressionError ? 'regression_blocked' : 'version_mismatch',
          ],
          userSafeMessage: err.message,
        },
        err
      );
      return createSaveDailyRecordResult({
        date: command.date,
        outcome: 'blocked',
        savedLocally: false,
        savedRemotely: false,
        queuedForRetry: false,
        autoMerged: false,
        consistencyState: remoteState.consistencyState,
        sourceOfTruth: 'none',
        retryability: remoteState.retryability,
        recoveryAction: remoteState.recoveryAction,
        conflictSummary: remoteState.conflictSummary,
        observabilityTags: remoteState.observabilityTags,
        userSafeMessage: remoteState.userSafeMessage,
        blockingReason: remoteState.blockingReason,
        repairApplied: false,
        blockingError: remoteState.blockingError,
      });
    }
    throw err;
  }

  await saveToIndexedDB(validatedRecord);

  if (isFirestoreEnabled()) {
    try {
      await saveRecordToFirestore(validatedRecord, command.expectedLastUpdated);
      remoteState.savedRemotely = true;
      remoteState.consistencyState = 'persisted_and_synced';
      remoteState.recoveryAction = 'none';
      remoteState.retryability = 'not_applicable';
      remoteState.observabilityTags = ['daily_record', 'write', 'persisted_and_synced'];
    } catch (err) {
      dailyRecordWriteLogger.warn(
        `Firestore sync failed for ${command.date}; data persisted in IndexedDB`,
        err
      );
      const nextAction = await applyRemoteRecovery(
        command.date,
        validatedRecord,
        ['*'],
        err,
        remoteState
      );
      if (nextAction === 'return') {
        return buildSaveResult(command.date, remoteState);
      }
    }
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

  const { record: validatedRecord, mergedPatches } = preparePatchedRecordForPersistence(
    current,
    command.date,
    command.patch
  );
  const patchedFields = Object.keys(mergedPatches).length;

  await saveToIndexedDB(validatedRecord);

  if (isFirestoreEnabled()) {
    try {
      await updateRecordPartialToFirestore(command.date, mergedPatches, current.lastUpdated);
      remoteState.savedRemotely = true;
      remoteState.consistencyState = 'persisted_and_synced';
      remoteState.recoveryAction = 'none';
      remoteState.retryability = 'not_applicable';
      remoteState.observabilityTags = ['daily_record', 'write', 'persisted_and_synced'];
    } catch (err) {
      dailyRecordWriteLogger.warn(`Firestore partial update failed for ${command.date}`, err);
      const nextAction = await applyRemoteRecovery(
        command.date,
        validatedRecord,
        Object.keys(mergedPatches),
        err,
        remoteState
      );
      if (nextAction === 'return') {
        return buildPartialUpdateResult(command.date, remoteState, patchedFields);
      }
    }
  }

  return buildPartialUpdateResult(command.date, remoteState, patchedFields);
};

export const updatePartial = async (date: string, partialData: DailyRecordPatch): Promise<void> => {
  const result = await updatePartialDetailed(date, partialData);
  if (result.blockingError) {
    throw result.blockingError;
  }
};
