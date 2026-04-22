import type { DailyRecord } from '@/types/domain/dailyRecord';
import { saveRecord as saveToIndexedDB } from '@/services/storage/indexeddb/indexedDbRecordService';
import { prepareDailyRecordForPersistence } from '@/services/repositories/dailyRecordPersistencePreparation';

/**
 * Local cache hydration must respect the same record invariants and admission
 * date policy used by repository writes. This keeps remote/legacy hydration from
 * silently reintroducing invalid critical fields into IndexedDB.
 */
export const persistHydratedRecordToLocalCache = async (
  record: DailyRecord,
  date: string,
  previousRecord?: DailyRecord | null
): Promise<DailyRecord> => {
  const validatedRecord = prepareDailyRecordForPersistence(record, date, previousRecord);
  await saveToIndexedDB(validatedRecord);
  return validatedRecord;
};
