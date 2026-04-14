/**
 * fonasaService
 *
 * Local search service for FONASA billing codes (Arancel FONASA).
 * Provides fast client-side search over two catalogs:
 *
 *  - **Anexo 9**: Intervenciones Quirúrgicas (~1113 entries)
 *  - **Anexo 14**: Procedimientos (~654 entries)
 *
 * Data sourced from Esquema_Registros_2026.xlsx (MINSAL).
 * The JSON database is lazy-loaded on first search to avoid
 * increasing the initial bundle size.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FonasaEntry {
  /** FONASA billing code (e.g. "1103049"). */
  code: string;
  /** Spanish description of the intervention or procedure. */
  description: string;
}

export type FonasaCatalog = 'interventions' | 'procedures';

interface FonasaDatabase {
  interventions: FonasaEntry[];
  procedures: FonasaEntry[];
}

// ---------------------------------------------------------------------------
// Lazy-loaded database
// ---------------------------------------------------------------------------

let databasePromise: Promise<FonasaDatabase> | null = null;

const loadDatabase = (): Promise<FonasaDatabase> => {
  databasePromise ??= import('@/services/terminology/fonasaDatabase.json').then(
    m => m.default as FonasaDatabase
  );
  return databasePromise;
};

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** Maximum results returned per search. */
const MAX_RESULTS = 15;

/**
 * Normalises a string for accent-insensitive, case-insensitive comparison.
 */
const normalise = (str: string): string =>
  str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

/**
 * Searches a FONASA catalog by query string (code or description).
 *
 * @param catalog - Which catalog to search: 'interventions' (Anexo 9)
 *                  or 'procedures' (Anexo 14).
 * @param query   - Free-text search query (min 2 characters).
 * @returns Up to {@link MAX_RESULTS} matching entries.
 */
export const searchFonasa = async (
  catalog: FonasaCatalog,
  query: string
): Promise<FonasaEntry[]> => {
  if (!query || query.length < 2) return [];

  const db = await loadDatabase();
  const entries = catalog === 'interventions' ? db.interventions : db.procedures;
  const normQuery = normalise(query);

  // Code-prefix match first, then description match
  const codeMatches: FonasaEntry[] = [];
  const descMatches: FonasaEntry[] = [];

  for (const entry of entries) {
    if (codeMatches.length + descMatches.length >= MAX_RESULTS) break;

    if (entry.code.startsWith(query)) {
      codeMatches.push(entry);
    } else if (normalise(entry.description).includes(normQuery)) {
      descMatches.push(entry);
    }
  }

  return [...codeMatches, ...descMatches].slice(0, MAX_RESULTS);
};
