import type { Workbook } from 'exceljs';
import type { CensusExportRecord } from '@/services/contracts/censusExportServiceContracts';
import { createWorkbook } from '../excelUtils';
import type { CensusMasterWorkbookOptions } from './censusWorkbookContracts';
import { applyCensusWorkbookMetadata } from './censusWorkbookMetadataController';
import { buildCensusWorkbookSheetDescriptors } from './censusWorkbookSheetDescriptorController';
import { reserveUniqueCensusSheetName } from './censusWorkbookSheetNameController';
import { createCensusWorkbookDaySheet } from './censusWorkbookDaySheetBuilder';
import { addCensusHiddenSheets } from './censusHiddenSheetsBuilder';

export const buildCensusMasterWorkbook = async (
  records: CensusExportRecord[],
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
  const resolvedSheets = descriptors.map(({ record, descriptor }) => ({
    record,
    descriptor,
    resolvedSheetName: reserveUniqueCensusSheetName(descriptor.sheetName, usedSheetNames),
  }));

  await addCensusHiddenSheets(workbook, resolvedSheets);

  resolvedSheets.forEach(({ record, descriptor, resolvedSheetName }) => {
    createCensusWorkbookDaySheet(workbook, record, resolvedSheetName, descriptor.snapshotLabel);
  });

  const firstVisibleSheetIndex = workbook.worksheets.findIndex(sheet => sheet.state !== 'hidden');
  if (firstVisibleSheetIndex >= 0) {
    // Excel opens the workbook on the active tab. Hidden support sheets are inserted first,
    // so we explicitly point the workbook view at the first visible day sheet.
    workbook.views = [
      {
        x: 0,
        y: 0,
        width: 10000,
        height: 20000,
        firstSheet: firstVisibleSheetIndex,
        activeTab: firstVisibleSheetIndex,
        visibility: 'visible',
      },
    ];
  }

  return workbook;
};
