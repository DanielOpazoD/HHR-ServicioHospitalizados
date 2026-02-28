/**
 * CIE-10 Spanish Database
 *
 * Comprehensive CIE-10 codes with official Spanish descriptions.
 * Fetches data asynchronously from a static JSON file to prevent bundle bloat.
 */

export interface CIE10Entry {
  code: string;
  description: string;
  category?: string;
}

let cachedDatabase: CIE10Entry[] | null = null;
let fetchPromise: Promise<CIE10Entry[]> | null = null;

/**
 * Ensures the CIE-10 database is loaded into memory.
 * Uses a singleton promise to prevent multiple concurrent network requests.
 * @returns Promise resolving to the complete array of CIE-10 entries.
 */
export const loadCIE10Database = async (): Promise<CIE10Entry[]> => {
  if (cachedDatabase) {
    return cachedDatabase;
  }

  if (fetchPromise) {
    return fetchPromise;
  }

  fetchPromise = fetch('/data/cie10_spanish.json')
    .then(response => {
      if (!response.ok) {
        throw new Error(`Failed to load CIE-10 database: ${response.statusText}`);
      }
      return response.json();
    })
    .then((data: CIE10Entry[]) => {
      cachedDatabase = data;
      return data;
    })
    .catch(error => {
      console.error('Error fetching CIE-10 data:', error);
      fetchPromise = null;
      throw error;
    });

  return fetchPromise;
};

/**
 * Searches the database securely, awaiting initialization if necessary.
 * @param query The search term
 * @param limit Maximum number of results to return
 */
export const searchCIE10 = async (query: string, limit = 50): Promise<CIE10Entry[]> => {
  if (!query || query.trim() === '') return [];

  const db = await loadCIE10Database();
  const normalizedQuery = query.toLowerCase().trim();

  return db
    .filter(
      entry =>
        entry.code.toLowerCase().includes(normalizedQuery) ||
        entry.description.toLowerCase().includes(normalizedQuery)
    )
    .slice(0, limit);
};

/**
 * Synchronous escape-hatch for legacy components.
 * Warning: Will throw or return empty if database is not yet loaded.
 * Preferred method is to use loadCIE10Database() or searchCIE10()
 */
export const getCIE10DatabaseSync = (): CIE10Entry[] => {
  if (!cachedDatabase) {
    console.warn('getCIE10DatabaseSync called before database was loaded.');
    return [];
  }
  return cachedDatabase;
};
