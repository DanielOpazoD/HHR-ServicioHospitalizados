import type { RowMenuAlign } from '@/features/census/components/patient-row/patientRowUiContracts';
import { buildOccupiedPatientRowIndicators } from '@/features/census/controllers/patientRowIndicatorsController';
import type { CensusTableResolvedOccupiedRow } from '@/features/census/types/censusTableComponentContracts';
import type { OccupiedBedRow } from '@/features/census/types/censusTableTypes';

const MENU_ALIGN_BOTTOM_THRESHOLD = 4;

export const resolvePatientRowMenuAlign = (index: number, totalRows: number): RowMenuAlign => {
  return index >= totalRows - MENU_ALIGN_BOTTOM_THRESHOLD ? 'bottom' : 'top';
};

export const shouldRenderEmptyBedsDivider = (emptyBedsCount: number): boolean => emptyBedsCount > 0;

interface BuildResolvedOccupiedRowsParams {
  occupiedRows: OccupiedBedRow[];
  currentDateString: string;
  clinicalDocumentPresenceByBedId: Record<string, boolean>;
}

export const buildResolvedOccupiedRows = ({
  occupiedRows,
  currentDateString,
  clinicalDocumentPresenceByBedId,
}: BuildResolvedOccupiedRowsParams): CensusTableResolvedOccupiedRow[] =>
  occupiedRows.map((row, index) => ({
    row,
    actionMenuAlign: resolvePatientRowMenuAlign(index, occupiedRows.length),
    indicators: buildOccupiedPatientRowIndicators({
      isSubRow: row.isSubRow,
      currentDateString,
      admissionDate: row.data.admissionDate,
      admissionTime: row.data.admissionTime,
      hasClinicalDocument: Boolean(clinicalDocumentPresenceByBedId[row.bed.id]),
    }),
  }));
