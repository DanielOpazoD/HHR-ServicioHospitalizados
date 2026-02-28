import { Workbook } from 'exceljs';
import { DailyRecord } from '@/types';
import { createWorkbook } from '../excelUtils';
import { calculateStats } from '../../calculations/statsCalculator';
import { formatSheetDate } from './formatters';
import { EXCEL_SHEET_NAME_MAX_LENGTH } from './styles';
import { addHeaderSection } from './sections/headerSection';
import { addSummarySection } from './sections/summarySection';
import { addCensusTable } from './sections/censusTable';
import { addDischargesTable } from './sections/dischargesTable';
import { addTransfersTable } from './sections/transfersTable';
import { addCMATable } from './sections/cmaTable';

export interface CensusWorkbookSheetDescriptor {
  recordDate: string;
  sheetName: string;
  snapshotLabel?: string;
  sortOrder?: number;
  recordLookupIndex?: number;
}

export interface CensusMasterWorkbookOptions {
  sheetDescriptors?: CensusWorkbookSheetDescriptor[];
}

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
  workbook.creator = 'Hospital Hanga Roa';
  workbook.created = new Date();

  const descriptors = buildSheetDescriptors(sourceRecords, sortedRecords, options);

  descriptors.forEach(({ record, descriptor }) => {
    const resolvedSheetName = reserveUniqueSheetName(descriptor.sheetName, usedSheetNames);
    createDaySheet(workbook, record, resolvedSheetName, descriptor.snapshotLabel);
  });

  return workbook;
};

function buildSheetDescriptors(
  sourceRecords: DailyRecord[],
  sortedRecords: DailyRecord[],
  options?: CensusMasterWorkbookOptions
) {
  const providedDescriptors = options?.sheetDescriptors || [];
  if (providedDescriptors.length === 0) {
    return sortedRecords.map((record, index) => ({
      record,
      descriptor: {
        recordDate: record.date,
        sheetName: formatSheetDate(record.date),
        sortOrder: index,
      } as CensusWorkbookSheetDescriptor,
    }));
  }

  return [...providedDescriptors]
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
    .map(descriptor => {
      const record =
        typeof descriptor.recordLookupIndex === 'number'
          ? sourceRecords[descriptor.recordLookupIndex]
          : sourceRecords.find(candidate => candidate.date === descriptor.recordDate);
      if (!record) {
        throw new Error(`No se encontró registro para la fecha: ${descriptor.recordDate}`);
      }
      return { record, descriptor };
    });
}

function createDaySheet(
  workbook: Workbook,
  record: DailyRecord,
  sheetName: string,
  snapshotLabel?: string
): void {
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

  const widths = [4, 10, 9, 24, 16, 8, 28, 16, 12, 12, 7, 7, 7, 7, 18];
  widths.forEach((width, idx) => {
    if (sheet.columns[idx]) sheet.columns[idx].width = width;
  });
}

function reserveUniqueSheetName(baseName: string, usedNames: Set<string>): string {
  const sanitizedBase = baseName
    .replace(/[\\/?*:[\]]/g, '-')
    .trim()
    .slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
  if (!usedNames.has(sanitizedBase)) {
    usedNames.add(sanitizedBase);
    return sanitizedBase;
  }

  let suffix = 2;
  while (suffix < 1000) {
    const candidate = `${sanitizedBase} (${suffix})`.slice(0, EXCEL_SHEET_NAME_MAX_LENGTH);
    if (!usedNames.has(candidate)) {
      usedNames.add(candidate);
      return candidate;
    }
    suffix++;
  }
  return sanitizedBase;
}
