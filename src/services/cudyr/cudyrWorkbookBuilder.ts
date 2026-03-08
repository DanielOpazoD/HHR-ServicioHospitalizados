import type { Workbook, Worksheet } from 'exceljs';
import { createWorkbook, BORDER_THIN } from '@/services/exporters/excelUtils';
import type {
  CategoryCounts,
  CudyrCategory,
  CudyrDailySummary,
  CudyrMonthlySummary,
} from './cudyrSummary';

const CATEGORIES: CudyrCategory[] = [
  'A1',
  'A2',
  'A3',
  'B1',
  'B2',
  'B3',
  'C1',
  'C2',
  'C3',
  'D1',
  'D2',
  'D3',
];

export const MONTHS_ES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const DAILY_SHEET_CATEGORY_START_ROW = 4;
const DAILY_SHEET_OCCUPIED_ROW = 19;
const DAILY_SHEET_CATEGORIZED_ROW = 20;

const formatDateDMY = (dateStr: string): string => {
  const [year, month, day] = dateStr.split('-');
  return `${day}-${month}-${year}`;
};

const buildMonthlyCutoffLabel = (year: number, month: number, endDate?: string): string => {
  const endDateFormatted = endDate
    ? formatDateDMY(endDate)
    : `${new Date(year, month, 0).getDate()}-${String(month).padStart(2, '0')}-${year}`;
  return `hasta el último registro disponible del ${endDateFormatted}`;
};

const escapeSheetName = (name: string): string => {
  if (/[^\w]/.test(name)) {
    return `'${name}'`;
  }
  return name;
};

const safeResult = (val: number | string): number | string => (val === 0 ? '0' : val);

const addDailySummaryTable = (
  sheet: Worksheet,
  counts: CategoryCounts,
  utiTotal: number,
  mediaTotal: number,
  startRow: number
): number => {
  const headerRow = sheet.getRow(startRow);
  headerRow.values = ['CAT', 'UTI', 'MEDIA', 'TOTAL'];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
  ['A', 'B', 'C', 'D'].forEach(col => {
    const cell = sheet.getCell(`${col}${startRow}`);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = BORDER_THIN;
  });

  let currentRow = startRow + 1;
  CATEGORIES.forEach(cat => {
    const row = sheet.getRow(currentRow);
    const utiCount = counts.uti[cat];
    const mediaCount = counts.media[cat];
    row.values = [cat, utiCount, mediaCount, utiCount + mediaCount];
    row.alignment = { horizontal: 'center' };
    ['A', 'B', 'C', 'D'].forEach(col => {
      sheet.getCell(`${col}${currentRow}`).border = BORDER_THIN;
    });
    currentRow++;
  });

  const totalRow = sheet.getRow(currentRow);
  totalRow.values = ['TOTAL', utiTotal, mediaTotal, utiTotal + mediaTotal];
  totalRow.font = { bold: true };
  totalRow.alignment = { horizontal: 'center' };
  ['A', 'B', 'C', 'D'].forEach(col => {
    const cell = sheet.getCell(`${col}${currentRow}`);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    cell.border = BORDER_THIN;
  });

  return currentRow + 1;
};

const addDailyOccupationStats = (
  sheet: Worksheet,
  occupiedCount: number,
  categorizedCount: number,
  startRow: number
): number => {
  const sectionRow = sheet.getRow(startRow);
  sectionRow.values = ['Estadisticas de Ocupacion'];
  sectionRow.font = { bold: true, size: 11 };
  sheet.mergeCells(`A${startRow}:D${startRow}`);

  const occupiedRow = sheet.getRow(startRow + 1);
  occupiedRow.values = ['Camas Ocupadas', occupiedCount];
  occupiedRow.getCell(1).font = { bold: true };
  occupiedRow.getCell(2).alignment = { horizontal: 'center' };

  const categorizedRow = sheet.getRow(startRow + 2);
  categorizedRow.values = ['Pacientes Categorizados', categorizedCount];
  categorizedRow.getCell(1).font = { bold: true };
  categorizedRow.getCell(2).alignment = { horizontal: 'center' };

  const indexVal = occupiedCount > 0 ? Math.round((categorizedCount / occupiedCount) * 100) : 0;
  const indexRow = sheet.getRow(startRow + 3);
  indexRow.values = ['Indice de Categorizacion'];
  indexRow.getCell(1).font = { bold: true };

  const indexCell = sheet.getCell(`B${startRow + 3}`);
  indexCell.value = {
    formula: `IF(B${startRow + 1}=0,0,ROUND(B${startRow + 2}/B${startRow + 1}*100,0))`,
    result: safeResult(indexVal),
  };
  indexCell.numFmt = '0"%"';
  indexCell.alignment = { horizontal: 'center' };

  return startRow + 4;
};

const addMonthlySummaryTableWithFormulas = (
  sheet: Worksheet,
  sheetNames: string[],
  startRow: number,
  totals: CategoryCounts,
  utiTotal: number,
  mediaTotal: number
): number => {
  const headerRow = sheet.getRow(startRow);
  headerRow.values = ['CAT', 'UTI', 'MEDIA', 'TOTAL'];
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: 'center' };
  ['A', 'B', 'C', 'D'].forEach(col => {
    const cell = sheet.getCell(`${col}${startRow}`);
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = BORDER_THIN;
  });

  let currentRow = startRow + 1;
  CATEGORIES.forEach((cat, idx) => {
    const row = sheet.getRow(currentRow);
    const dailyDataRow = DAILY_SHEET_CATEGORY_START_ROW + idx;

    row.getCell(1).value = cat;
    row.getCell(1).alignment = { horizontal: 'center' };
    row.getCell(1).border = BORDER_THIN;

    const utiVal = totals.uti[cat];
    const mediaVal = totals.media[cat];
    const totalVal = utiVal + mediaVal;

    const utiFormula = sheetNames
      .map(name => `${escapeSheetName(name)}!B${dailyDataRow}`)
      .join('+');
    row.getCell(2).value = { formula: utiFormula, result: safeResult(utiVal) };
    row.getCell(2).alignment = { horizontal: 'center' };
    row.getCell(2).border = BORDER_THIN;

    const mediaFormula = sheetNames
      .map(name => `${escapeSheetName(name)}!C${dailyDataRow}`)
      .join('+');
    row.getCell(3).value = { formula: mediaFormula, result: safeResult(mediaVal) };
    row.getCell(3).alignment = { horizontal: 'center' };
    row.getCell(3).border = BORDER_THIN;

    row.getCell(4).value = {
      formula: `B${currentRow}+C${currentRow}`,
      result: safeResult(totalVal),
    };
    row.getCell(4).alignment = { horizontal: 'center' };
    row.getCell(4).border = BORDER_THIN;

    currentRow++;
  });

  const totalVal = utiTotal + mediaTotal;
  const totalRow = sheet.getRow(currentRow);
  totalRow.getCell(1).value = 'TOTAL';
  totalRow.getCell(1).font = { bold: true };
  totalRow.getCell(1).alignment = { horizontal: 'center' };
  totalRow.getCell(1).border = BORDER_THIN;

  totalRow.getCell(2).value = {
    formula: `SUM(B${startRow + 1}:B${currentRow - 1})`,
    result: safeResult(utiTotal),
  };
  totalRow.getCell(2).font = { bold: true };
  totalRow.getCell(2).alignment = { horizontal: 'center' };
  totalRow.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  totalRow.getCell(2).border = BORDER_THIN;

  totalRow.getCell(3).value = {
    formula: `SUM(C${startRow + 1}:C${currentRow - 1})`,
    result: safeResult(mediaTotal),
  };
  totalRow.getCell(3).font = { bold: true };
  totalRow.getCell(3).alignment = { horizontal: 'center' };
  totalRow.getCell(3).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  totalRow.getCell(3).border = BORDER_THIN;

  totalRow.getCell(4).value = {
    formula: `SUM(D${startRow + 1}:D${currentRow - 1})`,
    result: safeResult(totalVal),
  };
  totalRow.getCell(4).font = { bold: true };
  totalRow.getCell(4).alignment = { horizontal: 'center' };
  totalRow.getCell(4).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
  totalRow.getCell(4).border = BORDER_THIN;

  return currentRow + 1;
};

const addMonthlyOccupationStatsWithFormulas = (
  sheet: Worksheet,
  sheetNames: string[],
  startRow: number,
  totalOccupied: number,
  totalCategorized: number
): number => {
  const sectionRow = sheet.getRow(startRow);
  sectionRow.values = ['Estadisticas de Ocupacion (Acumulado)'];
  sectionRow.font = { bold: true, size: 11 };
  sheet.mergeCells(`A${startRow}:D${startRow}`);

  const occupiedRow = sheet.getRow(startRow + 1);
  occupiedRow.getCell(1).value = 'Camas Ocupadas';
  occupiedRow.getCell(1).font = { bold: true };
  const occupiedFormula = sheetNames
    .map(name => `${escapeSheetName(name)}!B${DAILY_SHEET_OCCUPIED_ROW}`)
    .join('+');
  occupiedRow.getCell(2).value = { formula: occupiedFormula, result: safeResult(totalOccupied) };
  occupiedRow.getCell(2).alignment = { horizontal: 'center' };

  const categorizedRow = sheet.getRow(startRow + 2);
  categorizedRow.getCell(1).value = 'Pacientes Categorizados';
  categorizedRow.getCell(1).font = { bold: true };
  const categorizedFormula = sheetNames
    .map(name => `${escapeSheetName(name)}!B${DAILY_SHEET_CATEGORIZED_ROW}`)
    .join('+');
  categorizedRow.getCell(2).value = {
    formula: categorizedFormula,
    result: safeResult(totalCategorized),
  };
  categorizedRow.getCell(2).alignment = { horizontal: 'center' };

  const indexVal = totalOccupied > 0 ? Math.round((totalCategorized / totalOccupied) * 100) : 0;
  const indexRow = sheet.getRow(startRow + 3);
  indexRow.getCell(1).value = 'Indice de Categorizacion';
  indexRow.getCell(1).font = { bold: true };
  indexRow.getCell(2).value = {
    formula: `IF(B${startRow + 1}=0,0,ROUND(B${startRow + 2}/B${startRow + 1}*100,0))`,
    result: safeResult(indexVal),
  };
  indexRow.getCell(2).numFmt = '0"%"';
  indexRow.getCell(2).alignment = { horizontal: 'center' };

  return startRow + 4;
};

const addDailySheets = (workbook: Workbook, dailySummaries: CudyrDailySummary[]): string[] => {
  const dailySheetNames: string[] = [];

  dailySummaries.forEach(daySummary => {
    const sheetName = formatDateDMY(daySummary.date);
    dailySheetNames.push(sheetName);

    const daySheet = workbook.addWorksheet(sheetName);
    daySheet.columns = [{ width: 22 }, { width: 10 }, { width: 10 }, { width: 10 }];
    daySheet.getCell('A1').value = `CUDYR Diario del Registro - ${sheetName}`;
    daySheet.getCell('A1').font = { bold: true, size: 12 };
    daySheet.mergeCells('A1:D1');

    addDailySummaryTable(
      daySheet,
      daySummary.counts,
      daySummary.utiTotal,
      daySummary.mediaTotal,
      3
    );
    addDailyOccupationStats(daySheet, daySummary.occupiedCount, daySummary.categorizedCount, 18);
  });

  return dailySheetNames;
};

const addMonthlySummarySheet = (
  workbook: Workbook,
  year: number,
  month: number,
  endDate: string | undefined,
  monthlySummary: CudyrMonthlySummary,
  dailySheetNames: string[]
): void => {
  const summarySheet = workbook.addWorksheet('Resumen CUDYR Mensual', {
    properties: { tabColor: { argb: 'FF4CAF50' } },
  });
  summarySheet.columns = [{ width: 22 }, { width: 10 }, { width: 10 }, { width: 10 }];

  summarySheet.getCell('A1').value =
    `Resumen CUDYR mensual - ${MONTHS_ES[month - 1]} ${year} (${buildMonthlyCutoffLabel(year, month, endDate)})`;
  summarySheet.getCell('A1').font = { bold: true, size: 14 };
  summarySheet.mergeCells('A1:D1');

  if (dailySheetNames.length === 0) {
    summarySheet.getCell('A3').value = 'No hay datos para el periodo seleccionado.';
    summarySheet.getCell('A3').font = { italic: true, color: { argb: 'FF888888' } };
    return;
  }

  let currentRow = addMonthlySummaryTableWithFormulas(
    summarySheet,
    dailySheetNames,
    3,
    monthlySummary.totals,
    monthlySummary.utiTotal,
    monthlySummary.mediaTotal
  );
  currentRow += 2;

  addMonthlyOccupationStatsWithFormulas(
    summarySheet,
    dailySheetNames,
    currentRow,
    monthlySummary.totalOccupied,
    monthlySummary.totalCategorized
  );
};

interface BuildCudyrWorkbookParams {
  year: number;
  month: number;
  endDate?: string;
  monthlySummary: CudyrMonthlySummary;
}

export const buildCudyrWorkbook = async ({
  year,
  month,
  endDate,
  monthlySummary,
}: BuildCudyrWorkbookParams): Promise<{ workbook: Workbook; fileName: string }> => {
  const workbook = await createWorkbook();
  workbook.creator = 'Hospital Hanga Roa';
  workbook.created = new Date();

  const dailySheetNames = addDailySheets(workbook, monthlySummary.dailySummaries);
  addMonthlySummarySheet(workbook, year, month, endDate, monthlySummary, dailySheetNames);

  return {
    workbook,
    fileName: `CUDYR_Mensual_${MONTHS_ES[month - 1]}_${year}_${buildMonthlyCutoffLabel(year, month, endDate).replaceAll(' ', '_')}.xlsx`,
  };
};
