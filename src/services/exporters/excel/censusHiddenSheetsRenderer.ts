import type { Worksheet } from 'exceljs';

import { formatDateDDMMYYYY } from '@/services/exporters/excel/formatters';

import type { SummaryDayRow, UpcPatientPresentation } from './censusHiddenSheetsContracts';
import {
  HIDDEN_PASSWORD,
  setRowFill,
  SHEET_PROTECTION_OPTIONS,
  solidFill,
  SUMMARY_HEADERS,
  THIN_BORDER,
  toArgb,
  SPECIALTY_COLUMNS,
} from './censusHiddenSheetsStyles';

export const applyHiddenSheetProtection = async (sheet: Worksheet): Promise<void> => {
  await sheet.protect(HIDDEN_PASSWORD, SHEET_PROTECTION_OPTIONS);
  sheet.state = 'hidden';
};

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
  sheet.mergeCells('A1:P1');
  sheet.getCell('A1').value = `RESUMEN CENSO DIARIO — HOSPITAL HANGA ROA — ${monthName} ${year}`;
  sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A1').fill = solidFill('#1F4E79');
  sheet.getRow(1).height = 30;

  sheet.mergeCells('A2:P2');
  sheet.getCell('A2').value =
    `Período: ${formatDateDDMMYYYY(firstDate)} al ${formatDateDDMMYYYY(lastDate)} (${rows.length} días registrados)`;
  sheet.getCell('A2').font = {
    name: 'Arial',
    size: 10,
    italic: true,
    color: { argb: toArgb('#4472C4') },
  };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

  sheet.mergeCells('A4:P4');
  sheet.getCell('A4').value = 'CENSO DIARIO DE CAMAS Y MOVIMIENTOS';
  sheet.getCell('A4').font = {
    name: 'Arial',
    size: 11,
    bold: true,
    color: { argb: toArgb('#1F4E79') },
  };
  sheet.getCell('A4').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A4').fill = solidFill('#D6E4F0');
  sheet.getRow(4).height = 22;

  sheet.mergeCells('B5:F5');
  sheet.mergeCells('G5:J5');
  sheet.mergeCells('K5:P5');
  const groupHeaders = [
    { cell: 'B5', value: 'CENSO CAMAS', fill: '#1F4E79' },
    { cell: 'G5', value: 'MOVIMIENTOS', fill: '#548235' },
    { cell: 'K5', value: 'PACIENTES POR ESPECIALIDAD', fill: '#BF8F00' },
  ];
  groupHeaders.forEach(item => {
    const cell = sheet.getCell(item.cell);
    cell.value = item.value;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.fill = solidFill(item.fill);
    cell.border = THIN_BORDER;
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
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = solidFill(headerColors[index]);
    cell.border = THIN_BORDER;
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
          typeof row.occupancyRate === 'number' && row.occupancyRate > 0.88
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

  const summaryRows = [
    { label: 'Promedio', formula: 'AVERAGE', row: titleRowNumber + 1, fill: '#5B9BD5' },
    { label: 'Máximo', formula: 'MAX', row: titleRowNumber + 2, fill: '#C0504D' },
    { label: 'Mínimo', formula: 'MIN', row: titleRowNumber + 3, fill: '#70AD47' },
    { label: 'Total', formula: 'SUM', row: titleRowNumber + 4, fill: '#7F7F7F' },
  ];
  summaryRows.forEach(item => {
    const row = sheet.getRow(item.row);
    row.getCell(1).value = item.label;
    row.getCell(1).font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    row.getCell(1).fill = solidFill(item.fill);
    row.getCell(1).border = THIN_BORDER;
    row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
    for (let col = 2; col <= 16; col += 1) {
      const columnLetter = String.fromCharCode(64 + col);
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

  sheet.mergeCells('A1:K1');
  sheet.getCell('A1').value = `REGISTRO PACIENTES UPC — HOSPITAL HANGA ROA — ${monthName} ${year}`;
  sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A1').fill = solidFill('#7B2D26');
  sheet.getRow(1).height = 30;

  sheet.mergeCells('A2:K2');
  sheet.getCell('A2').value =
    `Pacientes con indicación UPC durante el período (total: ${patients.length})`;
  sheet.getCell('A2').font = {
    name: 'Arial',
    size: 10,
    italic: true,
    color: { argb: toArgb('#C00000') },
  };
  sheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };

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
    const cell = headerRow.getCell(index + 1);
    cell.value = header;
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = solidFill('#7B2D26');
    cell.border = THIN_BORDER;
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
  const lastColumnLetter = (() => {
    let dividend = lastColumnIndex;
    let columnName = '';
    while (dividend > 0) {
      const modulo = (dividend - 1) % 26;
      columnName = String.fromCharCode(65 + modulo) + columnName;
      dividend = Math.floor((dividend - modulo) / 26);
    }
    return columnName;
  })();

  sheet.columns = [
    { width: 30 },
    ...new Array(daysInMonth).fill(null).map(() => ({ width: 5.5 })),
    { width: 7 },
    { width: 28 },
  ];

  sheet.mergeCells(`A1:${lastColumnLetter}1`);
  sheet.getCell('A1').value = `DETALLE DIARIO — PRESENCIA UPC POR PACIENTE — ${monthName} ${year}`;
  sheet.getCell('A1').font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
  sheet.getCell('A1').fill = solidFill('#7B2D26');
  sheet.getRow(1).height = 30;

  sheet.mergeCells(`A2:${lastColumnLetter}2`);
  sheet.getCell('A2').value =
    'Cada celda roja indica que el paciente estuvo catalogado como UPC ese día. La sigla indica la cama asignada.';
  sheet.getCell('A2').font = {
    name: 'Arial',
    size: 9,
    italic: true,
    color: { argb: toArgb('#7B2D26') },
  };
  sheet.getCell('A2').alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };

  const headerRow = sheet.getRow(4);
  headerRow.getCell(1).value = 'Paciente';
  headerRow.getCell(1).font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.getCell(1).fill = solidFill('#7B2D26');
  headerRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  headerRow.getCell(1).border = THIN_BORDER;
  for (let day = 1; day <= daysInMonth; day += 1) {
    const cell = headerRow.getCell(day + 1);
    cell.value = day;
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = solidFill('#7B2D26');
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
  }
  headerRow.getCell(daysInMonth + 2).value = 'Total';
  headerRow.getCell(daysInMonth + 3).value = 'Camas';
  [daysInMonth + 2, daysInMonth + 3].forEach(col => {
    const cell = headerRow.getCell(col);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = solidFill('#7B2D26');
    cell.alignment = { horizontal: 'center', vertical: 'middle' };
    cell.border = THIN_BORDER;
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
