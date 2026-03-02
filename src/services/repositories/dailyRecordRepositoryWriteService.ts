import { DailyRecord, DailyRecordPatch } from '@/types';
import {
  getRecordForDate as getRecordFromIndexedDB,
  saveRecord as saveToIndexedDB,
} from '@/services/storage/indexedDBService';
import {
  saveRecordToFirestore,
  updateRecordPartial as updateRecordPartialToFirestore,
} from '@/services/storage/firestoreService';
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

interface RemoteWriteState {
  savedRemotely: boolean;
  queuedForRetry: boolean;
  autoMerged: boolean;
}

const createRemoteWriteState = (): RemoteWriteState => ({
  savedRemotely: false,
  queuedForRetry: false,
  autoMerged: false,
});

const buildSaveResult = (date: string, state: RemoteWriteState) =>
  createSaveDailyRecordResult({
    date,
    savedLocally: true,
    savedRemotely: state.savedRemotely,
    queuedForRetry: state.queuedForRetry,
    autoMerged: state.autoMerged,
  });

const buildPartialUpdateResult = (date: string, state: RemoteWriteState, patchedFields: number) =>
  createUpdatePartialDailyRecordResult({
    date,
    savedLocally: true,
    updatedRemotely: state.savedRemotely,
    queuedForRetry: state.queuedForRetry,
    autoMerged: state.autoMerged,
    patchedFields,
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
    console.warn('[Repository] Could not perform integrity check, proceeding:', err);
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
    throw recovery.error;
  }

  state.queuedForRetry = recovery.queuedForRetry;
  state.autoMerged = recovery.autoMerged;
  return recovery.status === 'auto_merged' ? 'return' : 'continue';
};

export const save = async (record: DailyRecord, expectedLastUpdated?: string): Promise<void> => {
  const command = createSaveDailyRecordCommand(record, expectedLastUpdated);
  const remoteState = createRemoteWriteState();
  const validatedRecord = prepareDailyRecordForPersistence(command.record, command.date);

  await runRemoteSaveIntegrityCheck(command.date, validatedRecord);

  await saveToIndexedDB(validatedRecord);

  if (isFirestoreEnabled()) {
    try {
      await saveRecordToFirestore(validatedRecord, command.expectedLastUpdated);
      remoteState.savedRemotely = true;
    } catch (err) {
      console.warn('Firestore sync failed, data saved in IndexedDB:', err);
      const nextAction = await applyRemoteRecovery(
        command.date,
        validatedRecord,
        ['*'],
        err,
        remoteState
      );
      if (nextAction === 'return') {
        buildSaveResult(command.date, remoteState);
        return;
      }
    }
  }

  syncPatientsToMasterInBackground(validatedRecord);

  buildSaveResult(command.date, remoteState);
};

export const updatePartial = async (date: string, partialData: DailyRecordPatch): Promise<void> => {
  const command = createPartialUpdateDailyRecordCommand(date, partialData);
  const remoteState = createRemoteWriteState();
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
  const patchedFields = Object.keys(mergedPatches).length;

  await saveToIndexedDB(validatedRecord);

  if (isFirestoreEnabled()) {
    try {
      await updateRecordPartialToFirestore(command.date, mergedPatches, current.lastUpdated);
      remoteState.savedRemotely = true;
    } catch (err) {
      console.warn('[Repository] Firestore partial update failed:', err);
      const nextAction = await applyRemoteRecovery(
        command.date,
        validatedRecord,
        Object.keys(mergedPatches),
        err,
        remoteState
      );
      if (nextAction === 'return') {
        buildPartialUpdateResult(command.date, remoteState, patchedFields);
        return;
      }
    }
  }

  buildPartialUpdateResult(command.date, remoteState, patchedFields);
};
