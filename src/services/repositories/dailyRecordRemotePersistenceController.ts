import type { DailyRecord } from '@/types/domain/dailyRecord';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { resolveRemoteWriteRecovery } from '@/services/repositories/dailyRecordRemoteWriteController';
import {
  applyRecoveryDecisionToState,
  type RemoteWriteState,
} from '@/services/repositories/dailyRecordWriteState';

const markRemoteWriteSucceeded = (state: RemoteWriteState): void => {
  state.savedRemotely = true;
  state.consistencyState = 'persisted_and_synced';
  state.recoveryAction = 'none';
  state.retryability = 'not_applicable';
  state.observabilityTags = ['daily_record', 'write', 'persisted_and_synced'];
};

const applyRemoteRecovery = async (
  date: string,
  record: DailyRecord,
  fields: string[],
  error: unknown,
  state: RemoteWriteState,
  expectedVersion?: string
): Promise<'continue' | 'return'> => {
  const recovery = await resolveRemoteWriteRecovery(date, record, fields, error, expectedVersion);
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

export const persistLocalAndAttemptRemoteSync = async ({
  date,
  record,
  changedPaths,
  remoteState,
  remoteWrite,
  onRemoteFailure,
  expectedVersion,
}: {
  date: string;
  record: DailyRecord;
  changedPaths: string[];
  remoteState: RemoteWriteState;
  remoteWrite: () => Promise<void>;
  onRemoteFailure: (error: unknown) => void;
  expectedVersion?: string;
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
    return applyRemoteRecovery(date, record, changedPaths, err, remoteState, expectedVersion);
  }
};
