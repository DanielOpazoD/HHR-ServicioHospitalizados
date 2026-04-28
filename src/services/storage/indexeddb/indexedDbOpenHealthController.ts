import { isDatabaseClosedError } from './indexedDbCoreSupport';

export type IndexedDbOpenHealth = 'unopened' | 'ready' | 'closed';

interface IndexedDbHealthDatabase {
  isOpen: () => boolean;
  settings: {
    get: (key: string) => Promise<unknown>;
  };
}

export const resolveIndexedDbOpenHealth = async (
  database: IndexedDbHealthDatabase
): Promise<IndexedDbOpenHealth> => {
  if (!database.isOpen()) {
    return 'unopened';
  }

  try {
    await database.settings.get('__health_check__');
    return 'ready';
  } catch (error: unknown) {
    return isDatabaseClosedError(error) ? 'closed' : 'ready';
  }
};
