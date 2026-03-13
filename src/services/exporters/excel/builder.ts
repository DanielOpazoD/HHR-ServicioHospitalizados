import { Workbook } from 'exceljs';
import { DailyRecord } from '@/types';
import { createWorkbook } from '../excelUtils';
import type {
  CensusMasterWorkbookOptions,
  CensusWorkbookSheetDescriptor,
} from './censusWorkbookContracts';
import { applyCensusWorkbookMetadata } from './censusWorkbookMetadataController';
import { buildCensusWorkbookSheetDescriptors } from './censusWorkbookSheetDescriptorController';
import { reserveUniqueCensusSheetName } from './censusWorkbookSheetNameController';
import { createCensusWorkbookDaySheet } from './censusWorkbookDaySheetBuilder';

export const buildCensusMasterWorkbook = async (
  records: DailyRecord[],
  options?: CensusMasterWorkbookOptions
): Promise<Workbook> => {
  if (!records || records.length === 0) {
    throw new Error('No hay registros disponibles para generar el Excel maestro.');
  }

  const sortedRecords = [...records].sort((a, b) => a.date.localeCompare(b.date));
  const sourceRecords =
    options?.sheetDescriptors && options.sheetDescriptors.length > 0 ? [...records] : sortedRecords;
  const usedSheetNames = new Set<string>();
  const workbook = await createWorkbook();
  applyCensusWorkbookMetadata(workbook);

  const descriptors = buildCensusWorkbookSheetDescriptors(sourceRecords, sortedRecords, options);

  descriptors.forEach(({ record, descriptor }) => {
    const resolvedSheetName = reserveUniqueCensusSheetName(descriptor.sheetName, usedSheetNames);
    createCensusWorkbookDaySheet(workbook, record, resolvedSheetName, descriptor.snapshotLabel);
  });

  return workbook;
};
