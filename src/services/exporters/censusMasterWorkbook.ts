/**
 * Census Master Workbook Exporter - Facade
 */

import { DailyRecord } from '@/types/domain/dailyRecord';
import type { Workbook } from 'exceljs';
import { buildCensusMasterWorkbook as buildWorkbook } from './excel/builder';
import type {
  CensusMasterWorkbookOptions,
  CensusWorkbookSheetDescriptor,
} from './excel/censusWorkbookContracts';

export type { CensusMasterWorkbookOptions, CensusWorkbookSheetDescriptor };

/**
 * Build the formatted "Censo Maestro" workbook from an array of daily records.
 */
export const buildCensusMasterWorkbook = async (
  records: DailyRecord[],
  options?: CensusMasterWorkbookOptions
): Promise<Workbook> => {
  return buildWorkbook(records, options);
};

/**
 * Return a Node-friendly buffer for the workbook.
 */
export const buildCensusMasterBuffer = async (
  records: DailyRecord[],
  options?: CensusMasterWorkbookOptions
): Promise<Buffer> => {
  const workbook = await buildCensusMasterWorkbook(records, options);
  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(arrayBuffer);
};

/**
 * Helper to build the canonical filename for the master census export.
 * Format: "Censo diario HHR DD-MM-YYYY.xlsx"
 */
export const getCensusMasterFilename = (date: string): string => {
  const [year, month, day] = date.split('-');
  const formattedDate = `${day}-${month}-${year}`;
  return `Censo diario HHR ${formattedDate}.xlsx`;
};
