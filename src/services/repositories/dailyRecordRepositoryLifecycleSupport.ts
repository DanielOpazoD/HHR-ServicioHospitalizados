import { DailyRecord } from '@/types/domain/dailyRecord';
import { createScopedLogger } from '@/services/utils/loggerScope';

interface RemoteDeleteDependencies {
  isRemoteEnabled: boolean;
  loadRecord: (date: string) => Promise<DailyRecord | null>;
  moveToTrash: (record: DailyRecord) => Promise<void>;
  deleteRemote: (date: string) => Promise<void>;
}

const dailyRecordLifecycleLogger = createScopedLogger('DailyRecordRepositoryLifecycle');

export const softDeleteDailyRecordRemote = async (
  date: string,
  dependencies: RemoteDeleteDependencies
): Promise<void> => {
  if (!dependencies.isRemoteEnabled) {
    return;
  }

  try {
    const record = await dependencies.loadRecord(date);
    if (record) {
      await dependencies.moveToTrash(record);
    }

    await dependencies.deleteRemote(date);
  } catch (error) {
    dailyRecordLifecycleLogger.error('Failed to soft-delete from Firestore', error);
  }
};
