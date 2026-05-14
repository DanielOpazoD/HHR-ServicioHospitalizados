import { httpsCallable } from 'firebase/functions';
import type { DailyRecord } from '@/services/storage/storageDailyRecordContracts';
import type { SyncTaskContract } from '@/services/storage/syncQueueTypes';
import { defaultFunctionsRuntime } from '@/services/firebase-runtime/functionsRuntime';
import type { DailyRecordAuthorityMode } from '@/services/storage/firestore/dailyRecordAuthorityMode';

export interface DailyRecordAuthorityCallablePayload {
  date: string;
  record: DailyRecord;
  expectedLastUpdated?: string;
  mode: Exclude<DailyRecordAuthorityMode, 'client_only'>;
  origin?: string;
  syncContract?: SyncTaskContract;
  dryRun?: boolean;
}

export interface DailyRecordAuthorityCallableResponse {
  success: boolean;
  date: string;
  mode: Exclude<DailyRecordAuthorityMode, 'client_only'>;
  authorityStatus: 'ok' | 'blocked';
  coverage?: {
    activePatients: number;
    canonicalEpisodeIds: number;
    fallbackEpisodeKeys: number;
    degenerateFallbackEpisodeKeys: number;
  };
  violations: Array<{
    type: string;
    path: string;
    bedId?: string;
    episodeKey?: string;
    message?: string;
  }>;
}

export const saveDailyRecordWithClinicalAuthorityCallable = async (
  payload: DailyRecordAuthorityCallablePayload
): Promise<DailyRecordAuthorityCallableResponse> => {
  const functions = await defaultFunctionsRuntime.getFunctions();
  const callable = httpsCallable<
    DailyRecordAuthorityCallablePayload,
    DailyRecordAuthorityCallableResponse
  >(functions, 'saveDailyRecordWithClinicalAuthority');

  const result = await callable(payload);
  return result.data;
};
