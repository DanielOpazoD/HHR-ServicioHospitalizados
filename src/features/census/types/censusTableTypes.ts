import type { BedDefinition, BedType } from '@/types/domain/beds';
import type { PatientData } from '@/features/census/types/censusTablePatientContracts';

export type DiagnosisMode = 'free' | 'cie10';

export interface OccupiedBedRow {
  id: string;
  bed: BedDefinition;
  data: PatientData;
  isSubRow: boolean;
}

export interface CensusBedRows {
  occupiedRows: OccupiedBedRow[];
  emptyBeds: BedDefinition[];
}

export type BedTypesById = Record<string, BedType>;
