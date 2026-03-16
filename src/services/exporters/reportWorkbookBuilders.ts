import type { Workbook } from 'exceljs';

import { getForDate as getRecordForDate } from '@/services/repositories/dailyRecordRepositoryReadService';
import { getAllRecords } from '@/services/storage/records';
import {
  buildCensusDailyRawWorkbook,
  extractRowsFromRecord,
  getCensusRawHeader,
} from './censusRawWorkbook';
import { BEDS } from '@/constants/beds';
import { createWorkbook } from './excelUtils';

const createRecordRangeSheet = async (
  sheetName: string,
  dates: string[],
  allRecords: Awaited<ReturnType<typeof getAllRecords>>
): Promise<Workbook> => {
  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(getCensusRawHeader());

  dates.forEach(date => {
    const rows = extractRowsFromRecord(allRecords[date]);
    rows.forEach(row => sheet.addRow(row));
  });

  return workbook;
};

export const applyCensusRawFormatting = (worksheet: ReturnType<Workbook['addWorksheet']>) => {
  worksheet.views = [{ state: 'frozen', ySplit: 1 }];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF0F4C81' },
  };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  headerRow.height = 22;

  worksheet.columns.forEach(column => {
    column.width = Math.min(Math.max((column.header?.toString().length || 12) + 2, 12), 36);
  });
};

export const getRecordOrAlert = async (
  date: string,
  message = 'No hay datos para la fecha seleccionada.'
) => {
  const record = await getRecordForDate(date);
  if (!record) {
    alert(message);
    return null;
  }
  return record;
};

export const getRangeDatesOrAlert = async (
  startDate: string,
  endDate: string,
  message = 'No hay registros en el rango de fechas seleccionado.'
) => {
  const allRecords = await getAllRecords();
  const dates = Object.keys(allRecords)
    .filter(date => date >= startDate && date <= endDate)
    .sort();

  if (dates.length === 0) {
    alert(message);
    return null;
  }

  return { allRecords, dates };
};

export const buildDailyRawWorkbookOrNull = async (date: string) => {
  const record = await getRecordOrAlert(date);
  if (!record) return null;
  return buildCensusDailyRawWorkbook(record);
};

export const buildRangeRawWorkbookOrNull = async (startDate: string, endDate: string) => {
  const rangeData = await getRangeDatesOrAlert(startDate, endDate);
  if (!rangeData) return null;
  return createRecordRangeSheet('Censo Bruto del Rango', rangeData.dates, rangeData.allRecords);
};

export const buildDailyFormattedWorkbookOrNull = async (date: string) => {
  const record = await getRecordOrAlert(date);
  if (!record) return null;

  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet('Censo Formateado');
  sheet.addRow(getCensusRawHeader());
  extractRowsFromRecord(record).forEach(row => sheet.addRow(row));
  applyCensusRawFormatting(sheet);
  return workbook;
};

export const buildRangeFormattedWorkbookOrNull = async (startDate: string, endDate: string) => {
  const rangeData = await getRangeDatesOrAlert(startDate, endDate);
  if (!rangeData) return null;

  const workbook = await createRecordRangeSheet(
    'Censo Formateado del Rango',
    rangeData.dates,
    rangeData.allRecords
  );
  const worksheet = workbook.getWorksheet('Censo Formateado del Rango');
  if (worksheet) {
    applyCensusRawFormatting(worksheet);
  }
  return workbook;
};

export const buildCudyrDailyWorkbookOrNull = async (date: string) => {
  const record = await getRecordOrAlert(date, 'Sin datos');
  if (!record) return null;

  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet('CUDYR Diario del Registro');

  sheet.addRow([
    'FECHA',
    'CAMA',
    'PACIENTE',
    'RUT',
    'PUNTAJE_TOTAL',
    'CATEGORIA',
    'DEPENDENCIA',
    'RIESGO',
  ]);

  BEDS.forEach(bed => {
    const patient = record.beds[bed.id];
    if (patient && patient.patientName && patient.cudyr) {
      const total = Object.values(patient.cudyr).reduce(
        (sum: number, value: number) => sum + value,
        0
      );
      sheet.addRow([
        date,
        bed.name,
        patient.patientName,
        patient.rut,
        total,
        total >= 19 ? 'C1' : 'C2',
        '?',
        '?',
      ]);
    }
  });

  return workbook;
};
