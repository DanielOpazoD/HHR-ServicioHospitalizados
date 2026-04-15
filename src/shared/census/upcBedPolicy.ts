import type { UpcChecklistRecord } from '@/domain/upc/upcContracts';
import type { UpcClassification } from '@/domain/upc/upcClassification';

const UPC_ELIGIBLE_BED_IDS = new Set(['R1', 'R2', 'R3', 'R4', 'NEO1', 'NEO2']);

/**
 * Neo1/Neo2 can handle UTI patients but never UCI (protocol §3).
 */
const UCI_ELIGIBLE_BED_IDS = new Set(['R1', 'R2', 'R3', 'R4']);

export const isUpcEligibleBedId = (bedId?: string | null): boolean =>
  Boolean(bedId && UPC_ELIGIBLE_BED_IDS.has(bedId));

export const isUciEligibleBedId = (bedId?: string | null): boolean =>
  Boolean(bedId && UCI_ELIGIBLE_BED_IDS.has(bedId));

/** Derive UPC classification from the structured checklist. */
export const resolveUpcClassificationFromChecklist = (
  checklist: UpcChecklistRecord | undefined | null
): UpcClassification => checklist?.classification ?? null;

/** Backward-compat: derive boolean isUPC from checklist. */
export const resolveIsUpcFromChecklist = (
  checklist: UpcChecklistRecord | undefined | null
): boolean => checklist?.classification !== null && checklist?.classification !== undefined;

export const resolveNormalizedUpcFlag = (
  bedId: string | undefined | null,
  isUPC: boolean | undefined | null
): boolean => isUpcEligibleBedId(bedId) && Boolean(isUPC);

export const normalizePatientUpcForBed = <T extends { bedId?: string; isUPC?: boolean }>(
  patient: T,
  bedId: string
): T => {
  const normalizedIsUpc = resolveNormalizedUpcFlag(bedId, patient.isUPC);
  if (patient.bedId === bedId && Boolean(patient.isUPC) === normalizedIsUpc) {
    return patient;
  }

  return {
    ...patient,
    bedId,
    isUPC: normalizedIsUpc,
  };
};
