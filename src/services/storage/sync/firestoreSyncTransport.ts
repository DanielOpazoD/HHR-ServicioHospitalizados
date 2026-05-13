import { getDoc, setDoc } from 'firebase/firestore';
import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncTransportPort } from '@/services/storage/sync/syncQueuePorts';
import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import {
  docToRecord,
  sanitizeForFirestore,
  getRecordDocRef,
} from '@/services/storage/firestore/firestoreShared';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import { ConcurrencyError } from '@/services/storage/firestore/firestoreWriteSupport';
import { resolveDailyRecordConflict } from '@/services/repositories/conflictResolutionMatrix';
import {
  applyDailyRecordClinicalConsistencyCheck,
  recordClinicalConsistencyTelemetry,
} from '@/services/repositories/dailyRecordClinicalConsistencyCheck';
import {
  evaluateDailyRecordClinicalAuthority,
  recordClinicalAuthorityTelemetry,
  recordClinicalEpisodeIdCoverageTelemetry,
} from '@/services/repositories/dailyRecordClinicalAuthorityPolicy';

/**
 * Tolerance window for same-session rapid edits (e.g. clicking checkboxes fast).
 * Changes within this window are assumed to come from the same user/tab and
 * are allowed through. Changes older than this are likely from a different
 * PC/session with stale data and are blocked.
 */
const SAME_SESSION_TOLERANCE_MS = 30_000;

/**
 * Checks whether the remote record has been updated significantly more
 * recently than the local copy. If so, throws a ConcurrencyError to prevent
 * overwriting newer data from another session/PC.
 *
 * Small differences (< 30s) are tolerated to allow rapid same-user edits
 * without false positives.
 */
const toMillis = (value: string | undefined): number => {
  if (!value) return 0;
  const millis = new Date(value).getTime();
  return Number.isFinite(millis) ? millis : 0;
};

const getRemoteLastUpdated = (remoteData: Record<string, unknown>): string | undefined =>
  remoteData?.lastUpdated instanceof Object && 'toDate' in remoteData.lastUpdated
    ? (remoteData.lastUpdated as { toDate: () => Date }).toDate().toISOString()
    : typeof remoteData?.lastUpdated === 'string'
      ? remoteData.lastUpdated
      : undefined;

const assertSyncQueueConcurrency = (
  record: DailyRecord,
  remoteLastUpdated: string | undefined
): void => {
  const localLastUpdated = record.lastUpdated;
  if (!localLastUpdated) return;
  if (!remoteLastUpdated) return;

  const drift = toMillis(remoteLastUpdated) - toMillis(localLastUpdated);
  if (drift > SAME_SESSION_TOLERANCE_MS) {
    throw new ConcurrencyError(
      `Sync queue: remote record for ${record.date} is newer ` +
        `(remote=${remoteLastUpdated}, local=${localLastUpdated}, drift=${Math.round(drift / 1000)}s). ` +
        `Skipping stale write to prevent data loss.`
    );
  }
};

const shouldRevalidateAgainstRemote = (
  remoteLastUpdated: string | undefined,
  expectedVersion: string | undefined
): boolean => {
  if (!remoteLastUpdated || !expectedVersion) return false;
  return toMillis(remoteLastUpdated) - toMillis(expectedVersion) > SAME_SESSION_TOLERANCE_MS;
};

const resolveRecordForSyncTask = async (
  task: SyncTask,
  record: DailyRecord,
  runtime: FirestoreServiceRuntimePort
): Promise<DailyRecord> => {
  const docRef = getRecordDocRef(record.date, runtime);
  const remoteSnap = await getDoc(docRef);
  if (!remoteSnap.exists()) {
    return record;
  }

  const remoteData = remoteSnap.data() as Record<string, unknown>;
  const remoteLastUpdated = getRemoteLastUpdated(remoteData);

  if (!shouldRevalidateAgainstRemote(remoteLastUpdated, task.syncContract?.expectedVersion)) {
    assertSyncQueueConcurrency(record, remoteLastUpdated);
    return record;
  }

  const remoteRecord = docToRecord(remoteData, record.date);
  const mergedRecord = resolveDailyRecordConflict(remoteRecord, record, {
    changedPaths: task.syncContract?.changedPaths,
  });
  const consistency = applyDailyRecordClinicalConsistencyCheck(mergedRecord, {
    date: record.date,
    phase: 'sync_publish',
  });
  recordClinicalConsistencyTelemetry(consistency);

  if (consistency.status === 'blocked') {
    throw new ConcurrencyError(
      `Sync queue: stale task for ${record.date} was revalidated but still has blocked clinical consistency.`
    );
  }

  return consistency.record;
};

const syncDailyRecord = async (
  task: SyncTask,
  record: DailyRecord,
  runtime: FirestoreServiceRuntimePort
): Promise<void> => {
  await measureRepositoryOperation(
    'syncQueue.writeDailyRecord',
    async () => {
      const recordToWrite = await resolveRecordForSyncTask(task, record, runtime);
      const authority = evaluateDailyRecordClinicalAuthority(recordToWrite, {
        date: recordToWrite.date,
        phase: 'sync_publish',
      });
      recordClinicalAuthorityTelemetry(authority);
      recordClinicalEpisodeIdCoverageTelemetry(recordToWrite, {
        date: recordToWrite.date,
        phase: 'sync_publish',
      });

      if (authority.status === 'blocked') {
        throw new ConcurrencyError(
          `Sync queue: clinical authority blocked write for ${recordToWrite.date}.`
        );
      }

      await setDoc(
        getRecordDocRef(recordToWrite.date, runtime),
        sanitizeForFirestore(recordToWrite) as Record<string, unknown>,
        { merge: true }
      );
    },
    { thresholdMs: 180, context: record.date }
  );
};

export const createFirestoreSyncTransport = (
  runtime: FirestoreServiceRuntimePort = defaultFirestoreServiceRuntime
): SyncTransportPort => ({
  async run(task: SyncTask) {
    switch (task.type) {
      case 'UPDATE_DAILY_RECORD':
        await syncDailyRecord(task, task.payload as DailyRecord, runtime);
        return;
      default:
        throw new Error(`[SyncQueue] Unsupported task type: ${String(task.type)}`);
    }
  },
});
