import type { Workbook } from 'exceljs';

import {
  buildLogicalSnapshotSheets,
  buildSummaryRows,
  buildUpcPatients,
  getMonthContext,
} from './censusHiddenSheetsAggregation';
import type { CensusWorkbookSnapshotSheet } from './censusHiddenSheetsContracts';
import {
  applyHiddenSheetProtection,
  renderSummarySheet,
  renderUpcDailyMatrixSheet,
  renderUpcPatientsSheet,
} from './censusHiddenSheetsRenderer';

export type { CensusWorkbookSnapshotSheet } from './censusHiddenSheetsContracts';

/**
 * Builds the three hidden census support sheets and inserts them at the beginning of the workbook.
 * Visible day sheets are rendered afterwards by the shared census workbook builder.
 */
export const addCensusHiddenSheets = async (
  workbook: Workbook,
  snapshotSheets: CensusWorkbookSnapshotSheet[]
): Promise<void> => {
  if (snapshotSheets.length === 0) return;

  const logicalSheets = buildLogicalSnapshotSheets(snapshotSheets);
  const monthContext = getMonthContext(logicalSheets[logicalSheets.length - 1].record.date);
  const summaryRows = buildSummaryRows(logicalSheets);
  const upcPatients = buildUpcPatients(logicalSheets);

  const summarySheet = workbook.addWorksheet(
    `RESUMEN ${monthContext.monthName} ${monthContext.year}`
  );
  renderSummarySheet({
    sheet: summarySheet,
    rows: summaryRows,
    firstDate: logicalSheets[0]?.record.date || '',
    lastDate: logicalSheets[logicalSheets.length - 1]?.record.date || '',
    monthName: monthContext.monthName,
    year: monthContext.year,
  });

  const upcSheet = workbook.addWorksheet(
    `PACIENTES UPC ${monthContext.monthName} ${monthContext.year}`
  );
  renderUpcPatientsSheet({
    sheet: upcSheet,
    patients: upcPatients,
    monthName: monthContext.monthName,
    year: monthContext.year,
  });

  const matrixSheet = workbook.addWorksheet('DETALLE DIARIO UPC');
  renderUpcDailyMatrixSheet({
    sheet: matrixSheet,
    patients: upcPatients,
    monthName: monthContext.monthName,
    year: monthContext.year,
    daysInMonth: monthContext.daysInMonth,
  });

  await applyHiddenSheetProtection(summarySheet);
  await applyHiddenSheetProtection(upcSheet);
  await applyHiddenSheetProtection(matrixSheet);
};
