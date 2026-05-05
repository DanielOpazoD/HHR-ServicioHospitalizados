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
import { getRecordFromFirestore } from '@/services/storage/firestore/firestoreRecordQueries';
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

// Field shrinkage guard.
// Catches the family of bugs where a stale snapshot or a debounced commit
// overwrites a longer text field with a much shorter one. The 20-char
// floor avoids noise on short fields ("OK" -> "O" is not interesting);
// the 50% threshold catches paste-over and stale-snapshot replacements
// while letting normal edits through.
const FIELD_SHRINKAGE_MIN_PREV_LENGTH = 20;
const FIELD_SHRINKAGE_RATIO_THRESHOLD = 0.5;
type FieldShrinkage = { path: string; prevLength: number; nextLength: number };

const resolvePathOnRecord = (record: DailyRecord, path: string): unknown => {
  const segments = path.split('.');
  let current: unknown = record;
  for (const segment of segments) {
    if (current === null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[segment];
  }
  return current;
};

const isProtectedClinicalTextPath = (path: string): boolean =>
  /^beds\.[^.]+(\.clinicalCrib)?\.(pathology|handoffNote|handoffNoteDayShift|handoffNoteNightShift|medicalHandoffNote)$/.test(
    path
  );

const isMedicalHandoffEntriesPath = (path: string): boolean =>
  /^beds\.[^.]+(\.clinicalCrib)?\.medicalHandoffEntries$/.test(path);

const isSuspiciousTextShrinkage = (prevValue: string, nextValue: string): boolean => {
  if (nextValue.length === 0) return false;
  if (prevValue.length < FIELD_SHRINKAGE_MIN_PREV_LENGTH) return false;
  return nextValue.length / prevValue.length < FIELD_SHRINKAGE_RATIO_THRESHOLD;
};

const resolveEntryId = (entry: unknown, fallback: number): string =>
  String((entry as { id?: string | number } | null)?.id ?? fallback);

const reportMedicalEntryNoteShrinkage = (
  path: string,
  prevValue: unknown,
  nextValue: unknown
): FieldShrinkage[] => {
  if (!Array.isArray(prevValue) || !Array.isArray(nextValue)) return [];

  const previousEntries = new Map<string, unknown>();
  prevValue.forEach((entry, index) => previousEntries.set(resolveEntryId(entry, index), entry));

  return nextValue.flatMap((entry, index) => {
    const entryId = resolveEntryId(entry, index);
    const previousEntry = previousEntries.get(entryId);
    const previousNote = (previousEntry as { note?: unknown } | undefined)?.note;
    const nextNote = (entry as { note?: unknown } | undefined)?.note;
    if (typeof previousNote !== 'string' || typeof nextNote !== 'string') return [];
    if (!isSuspiciousTextShrinkage(previousNote, nextNote)) return [];
    return [
      {
        path: `${path}.${entryId}.note`,
        prevLength: previousNote.length,
        nextLength: nextNote.length,
      },
    ];
  });
};

const reportFieldShrinkage = (
  date: string,
  current: DailyRecord,
  patches: DailyRecordPatch
): FieldShrinkage[] => {
  const suspiciousShrinkages: FieldShrinkage[] = [];

  for (const [path, nextValue] of Object.entries(patches)) {
    const prevValue = resolvePathOnRecord(current, path);

    if (isMedicalHandoffEntriesPath(path)) {
      const entryShrinkages = reportMedicalEntryNoteShrinkage(path, prevValue, nextValue);
      entryShrinkages.forEach(shrinkage =>
        dailyRecordWriteLogger.warn(
          `Field shrinkage detected at ${shrinkage.path} for ${date}: ${shrinkage.prevLength} -> ${shrinkage.nextLength} chars`,
          { ...shrinkage, date }
        )
      );
      suspiciousShrinkages.push(...entryShrinkages);
      continue;
    }

    if (typeof nextValue !== 'string' || typeof prevValue !== 'string') continue;
    if (!isSuspiciousTextShrinkage(prevValue, nextValue)) continue;
    dailyRecordWriteLogger.warn(
      `Field shrinkage detected at ${path} for ${date}: ${prevValue.length} -> ${nextValue.length} chars`,
      { path, date, prevLength: prevValue.length, nextLength: nextValue.length }
    );
    if (isProtectedClinicalTextPath(path)) {
      suspiciousShrinkages.push({
        path,
        prevLength: prevValue.length,
        nextLength: nextValue.length,
      });
    }
  }

  return suspiciousShrinkages;
};

const hasRemoteVersionAdvanced = (remote: DailyRecord, current: DailyRecord): boolean => {
  const remoteUpdatedAt = new Date(remote.lastUpdated || '').getTime();
  const currentUpdatedAt = new Date(current.lastUpdated || '').getTime();
  if (!Number.isFinite(remoteUpdatedAt) || !Number.isFinite(currentUpdatedAt)) {
    return remote.lastUpdated !== current.lastUpdated;
  }
  return remoteUpdatedAt > currentUpdatedAt;
};

const resolveBlockingFieldShrinkages = async (
  date: string,
  current: DailyRecord,
  patches: DailyRecordPatch
): Promise<FieldShrinkage[]> => {
  const localShrinkages = reportFieldShrinkage(date, current, patches);
  if (localShrinkages.length === 0 || !isFirestoreEnabled()) {
    return [];
  }

  const remoteRecord = await getRecordFromFirestore(date);
  if (!remoteRecord || !hasRemoteVersionAdvanced(remoteRecord, current)) {
    return [];
  }

  const remoteShrinkages = reportFieldShrinkage(date, remoteRecord, patches);
  return remoteShrinkages.length > 0 ? remoteShrinkages : localShrinkages;
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
