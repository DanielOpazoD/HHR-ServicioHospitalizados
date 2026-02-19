import { ensureDbReady, hospitalDB as db } from './indexedDbCore';
import { CatalogRecord } from './indexedDbCatalogContracts';

export const getCatalogValues = async <T = string>(catalogId: string): Promise<T[]> => {
  try {
    await ensureDbReady();
    const catalog = (await db.catalogs.get(catalogId)) as CatalogRecord<T> | undefined;
    return catalog?.list || [];
  } catch (error) {
    console.error(`Failed to get catalog ${catalogId}:`, error);
    return [];
  }
};

export const saveCatalogValues = async <T = string>(
  catalogId: string,
  list: T[]
): Promise<void> => {
  try {
    await ensureDbReady();
    const payload: CatalogRecord<T> = {
      id: catalogId,
      list,
      lastUpdated: new Date().toISOString(),
    };
    await db.catalogs.put(payload);
  } catch (error) {
    console.error(`Failed to save catalog ${catalogId}:`, error);
  }
};

export const clearCatalog = async (catalogId: string): Promise<void> => {
  try {
    await ensureDbReady();
    await db.catalogs.delete(catalogId);
  } catch (error) {
    console.error(`Failed to clear catalog ${catalogId}:`, error);
  }
};

export const getCatalog = async (catalogId: string): Promise<string[]> => {
  return await getCatalogValues<string>(catalogId);
};

export const saveCatalog = async (catalogId: string, list: string[]): Promise<void> => {
  await saveCatalogValues<string>(catalogId, list);
};
