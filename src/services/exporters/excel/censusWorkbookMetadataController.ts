import type { Workbook } from 'exceljs';

export const applyCensusWorkbookMetadata = (workbook: Workbook): void => {
  workbook.creator = 'Hospital Hanga Roa';
  workbook.created = new Date();
};
