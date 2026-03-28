import type { MasterPatient } from '@/types/domain/patientMaster';
import { formatRut, isValidRut } from '@/utils/rutUtils';

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

export const normalizePatientSearchTerm = (term: string): string => term.trim();

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
