import type { RowMenuAlign } from '@/features/census/components/patient-row/patientRowUiContracts';
import { buildOccupiedPatientRowIndicators } from '@/features/census/controllers/patientRowIndicatorsController';
import type { CensusTableResolvedOccupiedRow } from '@/features/census/types/censusTableComponentContracts';
import type { UnifiedBedRow } from '@/features/census/types/censusTableTypes';

const MENU_ALIGN_BOTTOM_THRESHOLD = 4;

export const resolvePatientRowMenuAlign = (index: number, totalRows: number): RowMenuAlign => {
  return index >= totalRows - MENU_ALIGN_BOTTOM_THRESHOLD ? 'bottom' : 'top';
};

interface BuildResolvedOccupiedRowsParams {
  unifiedRows: UnifiedBedRow[];
  currentDateString: string;
  clinicalDocumentPresenceByBedId: Record<string, boolean>;
}

export const buildResolvedOccupiedRows = ({
  unifiedRows,
  currentDateString,
  clinicalDocumentPresenceByBedId,
}: BuildResolvedOccupiedRowsParams): CensusTableResolvedOccupiedRow[] => {
  const occupiedRows = unifiedRows.filter(
    (row): row is Extract<UnifiedBedRow, { kind: 'occupied' }> => row.kind === 'occupied'
  );

  return occupiedRows.map((row, index) => ({
    row,
    actionMenuAlign: resolvePatientRowMenuAlign(index, occupiedRows.length),
    indicators: buildOccupiedPatientRowIndicators({
      isSubRow: row.isSubRow,
      currentDateString,
      firstSeenDate: row.data.firstSeenDate,
      admissionDate: row.data.admissionDate,
      admissionTime: row.data.admissionTime,
      hasClinicalDocument: Boolean(clinicalDocumentPresenceByBedId[row.bed.id]),
    }),
  }));
};
