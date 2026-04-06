import { getDoc, setDoc } from 'firebase/firestore';
import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncTransportPort } from '@/services/storage/sync/syncQueuePorts';
import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';
import {
  sanitizeForFirestore,
  getRecordDocRef,
} from '@/services/storage/firestore/firestoreShared';
import { defaultFirestoreServiceRuntime } from '@/services/storage/firestore/firestoreServiceRuntime';
import type { FirestoreServiceRuntimePort } from '@/services/storage/firestore/ports/firestoreServiceRuntimePort';
import { ConcurrencyError } from '@/services/storage/firestore/firestoreWriteSupport';

/**
 * Checks whether the remote record has been updated more recently than
 * the local copy. If so, throws a ConcurrencyError to prevent overwriting
 * newer data from another session/PC.
 */
const assertSyncQueueConcurrency = async (
  record: DailyRecord,
  runtime: FirestoreServiceRuntimePort
): Promise<void> => {
  const localLastUpdated = record.lastUpdated;
  if (!localLastUpdated) return;

  const docRef = getRecordDocRef(record.date, runtime);
  const remoteSnap = await getDoc(docRef);
  if (!remoteSnap.exists()) return;

  const remoteData = remoteSnap.data();
  const remoteLastUpdated =
    remoteData?.lastUpdated instanceof Object && 'toDate' in remoteData.lastUpdated
      ? (remoteData.lastUpdated as { toDate: () => Date }).toDate().toISOString()
      : typeof remoteData?.lastUpdated === 'string'
        ? remoteData.lastUpdated
        : undefined;

  if (remoteLastUpdated && new Date(remoteLastUpdated) > new Date(localLastUpdated)) {
    throw new ConcurrencyError(
      `Sync queue: remote record for ${record.date} is newer ` +
        `(remote=${remoteLastUpdated}, local=${localLastUpdated}). ` +
        `Skipping stale write to prevent data loss.`
    );
  }
};

const syncDailyRecord = async (
  record: DailyRecord,
  runtime: FirestoreServiceRuntimePort
): Promise<void> => {
  await measureRepositoryOperation(
    'syncQueue.writeDailyRecord',
    async () => {
      await assertSyncQueueConcurrency(record, runtime);
      await setDoc(
        getRecordDocRef(record.date, runtime),
        sanitizeForFirestore(record) as Record<string, unknown>,
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
        await syncDailyRecord(task.payload as DailyRecord, runtime);
        return;
      default:
        throw new Error(`[SyncQueue] Unsupported task type: ${String(task.type)}`);
    }
  },
});
