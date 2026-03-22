import type { Workbook } from 'exceljs';

import type { DailyRecord } from '@/types/domain/dailyRecord';
import { calculateStats } from '@/services/calculations/statsCalculator';
import { addHeaderSection } from '@/services/exporters/excel/sections/headerSection';
import { addSummarySection } from '@/services/exporters/excel/sections/summarySection';
import { addCensusTable } from '@/services/exporters/excel/sections/censusTable';
import { addDischargesTable } from '@/services/exporters/excel/sections/dischargesTable';
import { addTransfersTable } from '@/services/exporters/excel/sections/transfersTable';
import { addCMATable } from '@/services/exporters/excel/sections/cmaTable';
import { applyCensusDaySheetColumnLayout } from '@/services/exporters/excel/censusWorkbookColumnLayout';

export const createCensusWorkbookDaySheet = (
  workbook: Workbook,
  record: DailyRecord,
  sheetName: string,
  snapshotLabel?: string
): void => {
  const sheet = workbook.addWorksheet(sheetName, {
    pageSetup: { paperSize: 9, orientation: 'landscape' },
  });

  let currentRow = 1;
  currentRow = addHeaderSection(sheet, record, currentRow, snapshotLabel);
  currentRow++;

  const stats = calculateStats(record.beds);
  currentRow = addSummarySection(sheet, record, stats, currentRow);
  currentRow++;

  currentRow = addCensusTable(sheet, record, currentRow);
  currentRow++;

  currentRow = addDischargesTable(sheet, record.discharges || [], currentRow);
  currentRow++;

  currentRow = addTransfersTable(sheet, record.transfers || [], currentRow);
  currentRow++;

  addCMATable(sheet, record.cma || [], currentRow);

  // Freeze panes: Header row and first 4 columns (up to Patient Name)
  sheet.views = [
    {
      state: 'frozen',
      xSplit: 4,
      ySplit: 11,
      topLeftCell: 'E12',
      activeCell: 'E12',
    },
  ];

  applyCensusDaySheetColumnLayout(sheet);
};
