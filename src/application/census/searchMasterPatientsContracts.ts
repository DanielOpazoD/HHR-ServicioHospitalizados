export const SEARCH_MASTER_PATIENTS_DEFAULT_LIMIT = 20;
export const SEARCH_MASTER_PATIENTS_MAX_LIMIT = 100;
export const SEARCH_MASTER_PATIENTS_MAX_QUERY_LENGTH = 120;

export interface SearchMasterPatientsInput {
  searchTerm: string;
  limitCount?: number;
}

export interface NormalizedSearchMasterPatientsInput {
  searchTerm: string;
  limitCount: number;
}

export const normalizeSearchMasterPatientsInput = (
  input: SearchMasterPatientsInput
): NormalizedSearchMasterPatientsInput => {
  const searchTerm = input.searchTerm.trim();
  const rawLimit = Number(input.limitCount);
  const normalizedLimit = Number.isFinite(rawLimit)
    ? Math.trunc(rawLimit)
    : SEARCH_MASTER_PATIENTS_DEFAULT_LIMIT;

  const limitCount = Math.min(
    SEARCH_MASTER_PATIENTS_MAX_LIMIT,
    Math.max(1, normalizedLimit || SEARCH_MASTER_PATIENTS_DEFAULT_LIMIT)
  );

  return { searchTerm, limitCount };
};

export const isSearchMasterPatientsQueryTooLong = (searchTerm: string): boolean =>
  searchTerm.length > SEARCH_MASTER_PATIENTS_MAX_QUERY_LENGTH;
