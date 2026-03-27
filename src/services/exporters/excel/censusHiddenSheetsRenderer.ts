import type { Worksheet } from 'exceljs';

import { formatDateDDMMYYYY } from '@/services/exporters/excel/formatters';

import type { SummaryDayRow, UpcPatientPresentation } from './censusHiddenSheetsContracts';
import {
  SPECIALTY_COLUMNS,
  SUMMARY_CONSOLIDATED_ROWS,
  SUMMARY_GROUP_HEADERS,
  SUMMARY_HEADERS,
  SUMMARY_OCCUPANCY_ALERT_THRESHOLD,
} from './censusHiddenSheetsConfig';
import {
  applyHeaderCell,
  getExcelColumnName,
  setMergedTitle,
  setRowFill,
} from './censusHiddenSheetsExcelHelpers';
import { solidFill, THIN_BORDER, toArgb } from './censusHiddenSheetsStyles';
export { applyHiddenSheetProtection } from './censusHiddenSheetsProtection';

interface RenderSummarySheetInput {
  sheet: Worksheet;
  rows: SummaryDayRow[];
  firstDate: string;
  lastDate: string;
  monthName: string;
  year: string;
}

export const renderSummarySheet = ({
  sheet,
  rows,
  firstDate,
  lastDate,
  monthName,
  year,
}: RenderSummarySheetInput) => {
  sheet.columns = [{ width: 14 }, ...new Array(15).fill(null).map(() => ({ width: 11 }))];
  setMergedTitle({
    sheet,
    range: 'A1:P1',
    value: `RESUMEN CENSO DIARIO — HOSPITAL HANGA ROA — ${monthName} ${year}`,
    font: { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: solidFill('#1F4E79'),
    rowHeight: 30,
  });
  setMergedTitle({
    sheet,
    range: 'A2:P2',
    value: `Período: ${formatDateDDMMYYYY(firstDate)} al ${formatDateDDMMYYYY(lastDate)} (${rows.length} días registrados)`,
    font: { name: 'Arial', size: 10, italic: true, color: { argb: toArgb('#4472C4') } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });
  setMergedTitle({
    sheet,
    range: 'A4:P4',
    value: 'CENSO DIARIO DE CAMAS Y MOVIMIENTOS',
    font: { name: 'Arial', size: 11, bold: true, color: { argb: toArgb('#1F4E79') } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: solidFill('#D6E4F0'),
    rowHeight: 22,
  });

  sheet.mergeCells('B5:F5');
  sheet.mergeCells('G5:J5');
  sheet.mergeCells('K5:P5');
  SUMMARY_GROUP_HEADERS.forEach(item => {
    applyHeaderCell({
      cell: sheet.getCell(item.cell),
      value: item.value,
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: solidFill(item.fill),
    });
  });

  const headerColors = [
    '#2E75B6',
    '#2E75B6',
    '#2E75B6',
    '#2E75B6',
    '#2E75B6',
    '#2E75B6',
    '#70AD47',
    '#70AD47',
    '#70AD47',
    '#70AD47',
    '#D4A017',
    '#D4A017',
    '#D4A017',
    '#D4A017',
    '#D4A017',
    '#D4A017',
  ];
  const headerRow = sheet.getRow(6);
  SUMMARY_HEADERS.forEach((header, index) => {
    applyHeaderCell({
      cell: headerRow.getCell(index + 1),
      value: header,
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: solidFill(headerColors[index]),
    });
  });

  rows.forEach((row, index) => {
    const excelRow = sheet.getRow(7 + index);
    excelRow.values = [
      row.displaySheetName,
      row.occupiedBeds,
      row.availableCapacity,
      row.blockedBeds,
      row.cribs,
      row.occupancyRate,
      row.discharges,
      row.transfers,
      row.cma,
      row.deceased,
      ...SPECIALTY_COLUMNS.map(item => row.specialtyCounts[item.key] || 0),
    ];
    setRowFill(excelRow, 1, 16, index % 2 === 0 ? '#FFFFFF' : '#F2F2F2');

    excelRow.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = { horizontal: colNumber === 1 ? 'left' : 'center', vertical: 'middle' };
      if (colNumber === 6) {
        cell.numFmt = '0%';
        cell.font =
          typeof row.occupancyRate === 'number' &&
          row.occupancyRate > SUMMARY_OCCUPANCY_ALERT_THRESHOLD
            ? { name: 'Arial', size: 10, bold: true, color: { argb: toArgb('#C00000') } }
            : { name: 'Arial', size: 10, color: { argb: toArgb('#000000') } };
      }
    });
  });

  const dataStart = 7;
  const dataEnd = rows.length + 6;
  const titleRowNumber = dataEnd + 2;
  sheet.mergeCells(`A${titleRowNumber}:P${titleRowNumber}`);
  const titleCell = sheet.getCell(`A${titleRowNumber}`);
  titleCell.value = 'INDICADORES CONSOLIDADOS';
  titleCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: toArgb('#1F4E79') } };
  titleCell.alignment = { horizontal: 'center', vertical: 'middle' };
  titleCell.fill = solidFill('#D6E4F0');
  sheet.getRow(titleRowNumber).height = 22;

  SUMMARY_CONSOLIDATED_ROWS.forEach((item, index) => {
    const rowNumber = titleRowNumber + index + 1;
    const row = sheet.getRow(rowNumber);
    row.getCell(1).value = item.label;
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).fill = solidFill(item.fill);
    row.getCell(1).border = THIN_BORDER;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 2; col <= 16; col += 1) {
      const columnLetter = getExcelColumnName(col);
      const cell = row.getCell(col);
      if (col === 6 && item.label === 'Total') {
        cell.value = '—';
      } else {
        cell.value = {
          formula: `${item.formula}(${columnLetter}${dataStart}:${columnLetter}${dataEnd})`,
        };
      }
      cell.font = { name: 'Arial', size: 10, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = solidFill('#FFFFFF');
      cell.border = THIN_BORDER;
      if (col === 6) {
        cell.numFmt = '0%';
      } else if (item.label === 'Promedio') {
        cell.numFmt = '0.0';
      } else {
        cell.numFmt = '0';
      }
    }
  });

  sheet.views = [{ state: 'frozen', ySplit: 6, topLeftCell: 'A7', activeCell: 'A7' }];
};

interface RenderUpcSheetInput {
  sheet: Worksheet;
  patients: UpcPatientPresentation[];
  monthName: string;
  year: string;
}

export const renderUpcPatientsSheet = ({
  sheet,
  patients,
  monthName,
  year,
}: RenderUpcSheetInput) => {
  sheet.columns = [
    { width: 5 },
    { width: 32 },
    { width: 16 },
    { width: 8 },
    { width: 38 },
    { width: 18 },
    { width: 28 },
    { width: 14 },
    { width: 10 },
    { width: 22 },
    { width: 14 },
  ];

  setMergedTitle({
    sheet,
    range: 'A1:K1',
    value: `REGISTRO PACIENTES UPC — HOSPITAL HANGA ROA — ${monthName} ${year}`,
    font: { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: solidFill('#7B2D26'),
    rowHeight: 30,
  });
  setMergedTitle({
    sheet,
    range: 'A2:K2',
    value: `Pacientes con indicación UPC durante el período (total: ${patients.length})`,
    font: { name: 'Arial', size: 10, italic: true, color: { argb: toArgb('#C00000') } },
    alignment: { horizontal: 'center', vertical: 'middle' },
  });

  const headers = [
    '#',
    'Paciente',
    'RUT',
    'Edad',
    'Diagnóstico',
    'Especialidad',
    'Cama / Historial',
    'F. Ingreso',
    'Días UPC',
    'Detalle Días UPC',
    'Cambio Cama',
  ];
  const headerRow = sheet.getRow(4);
  headers.forEach((header, index) => {
    applyHeaderCell({
      cell: headerRow.getCell(index + 1),
      value: header,
      font: { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle', wrapText: true },
      fill: solidFill('#7B2D26'),
    });
  });
  headerRow.height = 36;

  patients.forEach((patient, index) => {
    const row = sheet.getRow(5 + index);
    row.values = [
      index + 1,
      patient.patientName,
      patient.rut,
      patient.age,
      patient.diagnosis,
      patient.specialty,
      patient.history,
      formatDateDDMMYYYY(patient.admissionDate),
      patient.totalDays,
      patient.daysDetail,
      patient.changedBed ? 'Sí' : 'No',
    ];
    setRowFill(row, 1, 11, index % 2 === 0 ? '#FFF2CC' : '#FFFFFF');
    row.height = Math.max(30, patient.totalDays * 15);

    row.eachCell((cell, colNumber) => {
      cell.border = THIN_BORDER;
      cell.font = { name: 'Arial', size: 10 };
      cell.alignment = {
        horizontal: [2, 5, 7, 10].includes(colNumber) ? 'left' : 'center',
        vertical: 'middle',
        wrapText: [5, 7, 10].includes(colNumber),
      };
    });
    row.getCell(2).font = { name: 'Arial', size: 10, bold: true };
    if (patient.changedBed) {
      row.getCell(7).font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: toArgb('#C00000') },
      };
      row.getCell(11).font = {
        name: 'Arial',
        size: 10,
        bold: true,
        color: { argb: toArgb('#C00000') },
      };
    }
  });

  sheet.views = [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5', activeCell: 'A5' }];
};

interface RenderUpcDailyMatrixSheetInput extends RenderUpcSheetInput {
  daysInMonth: number;
}

export const renderUpcDailyMatrixSheet = ({
  sheet,
  patients,
  monthName,
  year,
  daysInMonth,
}: RenderUpcDailyMatrixSheetInput) => {
  const lastColumnIndex = daysInMonth + 3;
  const lastColumnLetter = getExcelColumnName(lastColumnIndex);

  sheet.columns = [
    { width: 30 },
    ...new Array(daysInMonth).fill(null).map(() => ({ width: 5.5 })),
    { width: 7 },
    { width: 28 },
  ];

  setMergedTitle({
    sheet,
    range: `A1:${lastColumnLetter}1`,
    value: `DETALLE DIARIO — PRESENCIA UPC POR PACIENTE — ${monthName} ${year}`,
    font: { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: solidFill('#7B2D26'),
    rowHeight: 30,
  });
  setMergedTitle({
    sheet,
    range: `A2:${lastColumnLetter}2`,
    value:
      'Cada celda roja indica que el paciente estuvo catalogado como UPC ese día. La sigla indica la cama asignada.',
    font: { name: 'Arial', size: 9, italic: true, color: { argb: toArgb('#7B2D26') } },
    alignment: { horizontal: 'left', vertical: 'middle', wrapText: true },
  });

  const headerRow = sheet.getRow(4);
  applyHeaderCell({
    cell: headerRow.getCell(1),
    value: 'Paciente',
    font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
    alignment: { horizontal: 'center', vertical: 'middle' },
    fill: solidFill('#7B2D26'),
  });
  for (let day = 1; day <= daysInMonth; day += 1) {
    applyHeaderCell({
      cell: headerRow.getCell(day + 1),
      value: day,
      font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: solidFill('#7B2D26'),
    });
  }
  headerRow.getCell(daysInMonth + 2).value = 'Total';
  headerRow.getCell(daysInMonth + 3).value = 'Camas';
  [daysInMonth + 2, daysInMonth + 3].forEach(col => {
    applyHeaderCell({
      cell: headerRow.getCell(col),
      value: headerRow.getCell(col).value as string,
      font: { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } },
      alignment: { horizontal: 'center', vertical: 'middle' },
      fill: solidFill('#7B2D26'),
    });
  });

  patients.forEach((patient, index) => {
    const row = sheet.getRow(5 + index);
    row.getCell(1).value = patient.patientName;
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true };
    row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    row.getCell(1).border = THIN_BORDER;

    const bedByDay = new Map(
      patient.dailyBeds.map(item => [Number(item.date.split('-')[2]), item.bedCode])
    );
    for (let day = 1; day <= daysInMonth; day += 1) {
      const cell = row.getCell(day + 1);
      const bedCode = bedByDay.get(day) || '';
      cell.value = bedCode;
      cell.border = THIN_BORDER;
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      if (bedCode) {
        cell.font = { name: 'Arial', size: 8, bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = solidFill('#C00000');
      } else {
        cell.fill = solidFill('#F2F2F2');
      }
    }

    const totalCell = row.getCell(daysInMonth + 2);
    totalCell.value = patient.totalDays;
    totalCell.font = { name: 'Arial', size: 10, bold: true };
    totalCell.fill = solidFill('#FFF2CC');
    totalCell.border = THIN_BORDER;
    totalCell.alignment = { horizontal: 'center', vertical: 'middle' };

    const historyCell = row.getCell(daysInMonth + 3);
    historyCell.value = patient.history;
    historyCell.font = patient.changedBed
      ? { name: 'Arial', size: 10, bold: true, color: { argb: toArgb('#C00000') } }
      : { name: 'Arial', size: 10, color: { argb: toArgb('#333333') } };
    historyCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
    historyCell.border = THIN_BORDER;

    row.height = 22;
  });

  sheet.views = [{ state: 'frozen', xSplit: 1, ySplit: 4, topLeftCell: 'B5', activeCell: 'B5' }];
};
