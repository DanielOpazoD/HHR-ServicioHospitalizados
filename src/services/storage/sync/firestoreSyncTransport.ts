import type { SyncTask } from '@/services/storage/syncQueueTypes';
import type { SyncTransportPort } from '@/services/storage/sync/syncQueuePorts';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import { getDailyRecordsPath } from '@/constants/firestorePaths';
import { db } from '@/services/infrastructure/db';
import { measureRepositoryOperation } from '@/services/repositories/repositoryPerformance';

const syncDailyRecord = async (record: DailyRecord): Promise<void> => {
  await measureRepositoryOperation(
    'syncQueue.writeDailyRecord',
    async () => {
      const path = getDailyRecordsPath();
      await db.setDoc(path, record.date, record, { merge: true });
    },
    { thresholdMs: 180, context: record.date }
  );
};

export const createFirestoreSyncTransport = (): SyncTransportPort => ({
  async run(task: SyncTask) {
    switch (task.type) {
      case 'UPDATE_DAILY_RECORD':
        await syncDailyRecord(task.payload as DailyRecord);
        return;
      default:
        throw new Error(`[SyncQueue] Unsupported task type: ${String(task.type)}`);
    }
  },
});
