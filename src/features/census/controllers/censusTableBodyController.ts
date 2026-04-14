import type { RowMenuAlign } from '@/features/census/components/patient-row/patientRowUiContracts';
import { buildOccupiedPatientRowIndicators } from '@/features/census/controllers/patientRowIndicatorsController';
import type { CensusTableResolvedOccupiedRow } from '@/features/census/types/censusTableComponentContracts';
import type { UnifiedBedRow } from '@/features/census/types/censusTableTypes';

const MENU_ALIGN_BOTTOM_THRESHOLD = 4;

const isOccupiedUnifiedBedRow = (
  row: UnifiedBedRow
): row is Extract<UnifiedBedRow, { kind: 'occupied' }> => row.kind === 'occupied';

const buildResolvedOccupiedRow = (
  row: Extract<UnifiedBedRow, { kind: 'occupied' }>,
  index: number,
  totalRows: number,
  currentDateString: string,
  clinicalDocumentPresenceByBedId: Record<string, boolean>,
  dischargedRuts: ReadonlySet<string>
): CensusTableResolvedOccupiedRow => ({
  row,
  actionMenuAlign: resolvePatientRowMenuAlign(index, totalRows),
  indicators: buildOccupiedPatientRowIndicators({
    isSubRow: row.isSubRow,
    currentDateString,
    firstSeenDate: row.data.firstSeenDate,
    admissionDate: row.data.admissionDate,
    admissionTime: row.data.admissionTime,
    hasClinicalDocument: Boolean(clinicalDocumentPresenceByBedId[row.bed.id]),
    wasDischargedSameDay: Boolean(row.data.rut && dischargedRuts.has(row.data.rut)),
  }),
});

export const resolvePatientRowMenuAlign = (index: number, totalRows: number): RowMenuAlign => {
  return index >= totalRows - MENU_ALIGN_BOTTOM_THRESHOLD ? 'bottom' : 'top';
};

interface BuildResolvedOccupiedRowsParams {
  unifiedRows: UnifiedBedRow[];
  currentDateString: string;
  clinicalDocumentPresenceByBedId: Record<string, boolean>;
  /**
   * Set of patient RUTs that were discharged on this census day.
   * Used to detect same-day readmissions for the new-admission badge.
   */
  dischargedRuts?: ReadonlySet<string>;
}

export const buildResolvedOccupiedRows = ({
  unifiedRows,
  currentDateString,
  clinicalDocumentPresenceByBedId,
  dischargedRuts = new Set(),
}: BuildResolvedOccupiedRowsParams): CensusTableResolvedOccupiedRow[] => {
  const occupiedRows = unifiedRows.filter(isOccupiedUnifiedBedRow);

  return occupiedRows.map((row, index) =>
    buildResolvedOccupiedRow(
      row,
      index,
      occupiedRows.length,
      currentDateString,
      clinicalDocumentPresenceByBedId,
      dischargedRuts
    )
  );
};
