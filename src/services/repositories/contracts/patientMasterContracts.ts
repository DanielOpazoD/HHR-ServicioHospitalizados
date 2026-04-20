import type { MasterPatient } from '@/types/domain/patientMaster';
import { formatRut, isValidRut } from '@/utils/rutUtils';
import { removeAccents } from '@/utils/stringUtils';

const MAX_QUERY_LIMIT = 1000;
const DEFAULT_QUERY_LIMIT = 20;

export const normalizeMasterPatientRut = (rut: string): string | null => {
  if (!rut || !isValidRut(rut)) return null;
  return formatRut(rut).toUpperCase();
};

export const sanitizePatientQueryLimit = (limitCount?: number): number => {
  if (!Number.isFinite(limitCount)) return DEFAULT_QUERY_LIMIT;
  const normalized = Math.trunc(limitCount as number);
  if (normalized < 1) return DEFAULT_QUERY_LIMIT;
  if (normalized > MAX_QUERY_LIMIT) return MAX_QUERY_LIMIT;
  return normalized;
};

/**
 * Normalizes search term for patient queries.
 * Converts to title case to match Firestore stored format (case-sensitive prefix queries).
 */
export const normalizePatientSearchTerm = (term: string): string => {
  const trimmed = term.trim();
  if (!trimmed) return '';
  return trimmed.toLowerCase().replace(/(?:^|\s)\S/g, char => char.toUpperCase());
};

export const normalizePatientSearchText = (term: string): string =>
  removeAccents(term.trim().toLowerCase()).replace(/\s+/g, ' ');

export const tokenizePatientSearchTerm = (term: string): string[] =>
  normalizePatientSearchText(term)
    .split(' ')
    .map(token => token.trim())
    .filter(Boolean);

export const patientMatchesSearchTokens = (
  patient: Pick<MasterPatient, 'fullName' | 'rut'>,
  tokens: string[]
): boolean => {
  if (tokens.length === 0) return false;

  const haystack = normalizePatientSearchText(`${patient.fullName} ${patient.rut}`);
  return tokens.every(token => haystack.includes(token));
};

export const createUpsertPatientCommand = (
  patient: Partial<MasterPatient> & { rut: string }
): (Partial<MasterPatient> & { rut: string }) | null => {
  const normalizedRut = normalizeMasterPatientRut(patient.rut);
  if (!normalizedRut) return null;

  return {
    ...patient,
    rut: normalizedRut,
  };
};

export const createBulkUpsertPatientsCommand = (
  patients: MasterPatient[]
): Array<MasterPatient & { rut: string }> =>
  patients
    .map(patient => {
      const normalizedRut = normalizeMasterPatientRut(patient.rut);
      if (!normalizedRut) return null;
      return {
        ...patient,
        rut: normalizedRut,
      };
    })
    .filter((item): item is MasterPatient & { rut: string } => item !== null);
