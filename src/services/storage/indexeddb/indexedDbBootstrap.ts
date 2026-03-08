import { attachIndexedDbWarningBindings } from '@/services/storage/indexeddb/indexedDbWarningBindings';
import type { HangaRoaDatabase } from '@/services/storage/indexeddb/indexedDbCore';

export const attachIndexedDbEvents = (
  database: HangaRoaDatabase,
  getRuntimeState: () => { isUsingMock: boolean; stickyFallbackMode: boolean },
  emittedIndexedDbWarnings: Set<string>
) => attachIndexedDbWarningBindings(database, getRuntimeState, emittedIndexedDbWarnings);

export const initializeIndexedDbDatabase = (
  createDatabase: () => HangaRoaDatabase,
  attachEvents: (database: HangaRoaDatabase) => void,
  onFallback: (error: unknown) => void
): HangaRoaDatabase => {
  try {
    const database = createDatabase();
    attachEvents(database);
    return database;
  } catch (error) {
    onFallback(error);
    const database = createDatabase();
    attachEvents(database);
    return database;
  }
};
