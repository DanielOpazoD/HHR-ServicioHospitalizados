import type { Workbook, Worksheet } from 'exceljs';

import { MONTH_NAMES } from '@/constants/export';
import { calculateStats } from '@/services/calculations/statsCalculator';
import type { CensusWorkbookSheetDescriptor } from '@/services/exporters/excel/censusWorkbookContracts';
import { formatDateDDMMYYYY } from '@/services/exporters/excel/formatters';
import type { DailyRecord } from '@/types/domain/dailyRecord';
import type { PatientData } from '@/types/domain/patient';
import { Specialty } from '@/types/domain/base';

export interface CensusWorkbookSnapshotSheet {
  record: DailyRecord;
  descriptor: CensusWorkbookSheetDescriptor;
  resolvedSheetName: string;
}

interface CensusLogicalSnapshotSheet extends CensusWorkbookSnapshotSheet {
  displaySheetName: string;
}

interface ExtractedPatientRow {
  patient: PatientData;
  bedCode: string;
}

interface SummaryDayRow {
  displaySheetName: string;
  occupiedBeds: number;
  availableCapacity: number;
  blockedBeds: number;
  cribs: number;
  occupancyRate: number | null;
  discharges: number;
  transfers: number;
  cma: number;
  deceased: number;
  specialtyCounts: Record<string, number>;
}

interface UpcPatientAggregate {
  key: string;
  patientName: string;
  rut: string;
  age: string;
  diagnosis: string;
  specialty: string;
  admissionDate: string;
  firstSeenDate: string;
  dailyBeds: Array<{ date: string; bedCode: string }>;
}

interface UpcPatientPresentation extends UpcPatientAggregate {
  totalDays: number;
  daysDetail: string;
  history: string;
  changedBed: boolean;
}

const HIDDEN_PASSWORD = 'HHR';
const SHEET_PROTECTION_OPTIONS = {
  selectLockedCells: false,
  selectUnlockedCells: false,
  formatCells: false,
  formatColumns: false,
  formatRows: false,
  insertColumns: false,
  insertRows: false,
  insertHyperlinks: false,
  deleteColumns: false,
  deleteRows: false,
  sort: false,
  autoFilter: false,
  pivotTables: false,
  spinCount: 1000,
} as const;

const THIN_BORDER = {
  top: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
  left: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
  bottom: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
  right: { style: 'thin' as const, color: { argb: 'FFB4C6E7' } },
};
const SPECIALTY_COLUMNS = [
  { key: Specialty.MEDICINA, header: 'Med Int.' },
  { key: Specialty.CIRUGIA, header: 'Cirugía' },
  { key: Specialty.PSIQUIATRIA, header: 'Psiq.' },
  { key: Specialty.GINECOBSTETRICIA, header: 'Gineco.' },
  { key: Specialty.PEDIATRIA, header: 'Ped.' },
  { key: Specialty.TRAUMATOLOGIA, header: 'Trauma.' },
] as const;

const SUMMARY_HEADERS = [
  'Fecha',
  'Ocupadas',
  'Libres',
  'Bloq.',
  'Cunas',
  '% Ocup.',
  'Altas',
  'Traslados',
  'H. Diurna',
  'Fallec.',
  ...SPECIALTY_COLUMNS.map(item => item.header),
];

const toArgb = (hex: string) => `FF${hex.replace('#', '').toUpperCase()}`;
const solidFill = (hex: string) => ({
  type: 'pattern' as const,
  pattern: 'solid' as const,
  fgColor: { argb: toArgb(hex) },
});

const setRowFill = (row: Worksheet['lastRow'], from: number, to: number, hex: string) => {
  if (!row) return;
  for (let col = from; col <= to; col += 1) {
    row.getCell(col).fill = solidFill(hex);
  }
};

const normalizeText = (value?: string | null): string => (value || '').trim();

const normalizePatientKey = (patient: PatientData): string =>
  normalizeText(patient.rut) || normalizeText(patient.patientName).toLocaleLowerCase('es-CL');

const isRealPatient = (patient?: PatientData | null): patient is PatientData =>
  Boolean(patient && !patient.isBlocked && normalizeText(patient.patientName));

const getMonthContext = (date: string) => {
  const [year, month] = date.split('-');
  const monthIndex = Number(month) - 1;
  return {
    year,
    monthIndex,
    monthName: (MONTH_NAMES[monthIndex] || '').toUpperCase(),
    daysInMonth: new Date(Number(year), Number(month), 0).getDate(),
  };
};

const sortByDate = <T extends { date: string }>(items: T[]) =>
  [...items].sort((a, b) => a.date.localeCompare(b.date));

const areConsecutiveDates = (previousDate: string, nextDate: string): boolean => {
  const previous = new Date(`${previousDate}T00:00:00Z`);
  const next = new Date(`${nextDate}T00:00:00Z`);
  const diff = next.getTime() - previous.getTime();
  return diff === 24 * 60 * 60 * 1000;
};

const formatSegment = (bedCode: string, startDate: string, endDate: string): string => {
  const start = formatDateDDMMYYYY(startDate);
  const end = formatDateDDMMYYYY(endDate);
  return start === end ? `${bedCode} (${start})` : `${bedCode} (${start} a ${end})`;
};

const buildBedHistory = (dailyBeds: Array<{ date: string; bedCode: string }>) => {
  if (dailyBeds.length === 0) {
    return { history: '', changedBed: false };
  }

  const ordered = sortByDate(dailyBeds);
  const segments: string[] = [];
  let currentBed = ordered[0].bedCode;
  let segmentStart = ordered[0].date;
  let previousDate = ordered[0].date;

  for (let index = 1; index < ordered.length; index += 1) {
    const current = ordered[index];
    const shouldExtend =
      current.bedCode === currentBed && areConsecutiveDates(previousDate, current.date);

    if (!shouldExtend) {
      segments.push(formatSegment(currentBed, segmentStart, previousDate));
      currentBed = current.bedCode;
      segmentStart = current.date;
    }

    previousDate = current.date;
  }

  segments.push(formatSegment(currentBed, segmentStart, previousDate));
  return {
    history: segments.join(' → '),
    changedBed: segments.length > 1,
  };
};

const collectRealPatients = (record: DailyRecord): ExtractedPatientRow[] => {
  const patients: ExtractedPatientRow[] = [];

  Object.entries(record.beds || {}).forEach(([bedId, bedData]) => {
    if (!bedData) return;

    const mainBedCode = bedData.location ? `${bedId} (${bedData.location})` : bedId;
    if (isRealPatient(bedData)) {
      patients.push({ patient: bedData, bedCode: mainBedCode });
    }

    if (isRealPatient(bedData.clinicalCrib)) {
      const cribBedCode = bedData.location ? `${bedId}-C (${bedData.location})` : `${bedId}-C`;
      patients.push({ patient: bedData.clinicalCrib, bedCode: cribBedCode });
    }
  });

  return patients;
};

const buildLogicalSnapshotSheets = (
  sheets: CensusWorkbookSnapshotSheet[]
): CensusLogicalSnapshotSheet[] => {
  const byDate = new Map<string, CensusLogicalSnapshotSheet>();
  sheets.forEach(sheet => {
    byDate.set(sheet.record.date, {
      ...sheet,
      displaySheetName: sheet.resolvedSheetName,
    });
  });
  return [...byDate.values()].sort((a, b) => a.record.date.localeCompare(b.record.date));
};

const buildSummaryRows = (sheets: CensusLogicalSnapshotSheet[]): SummaryDayRow[] =>
  sheets.map(sheet => {
    const stats = calculateStats(sheet.record.beds);
    const specialtyCounts = Object.fromEntries(SPECIALTY_COLUMNS.map(item => [item.key, 0]));
    collectRealPatients(sheet.record).forEach(({ patient }) => {
      const specialty = normalizeText(patient.specialty);
      if (specialtyCounts[specialty] !== undefined) {
        specialtyCounts[specialty] += 1;
      }
    });

    const denominator = stats.occupiedBeds + stats.availableCapacity;
    return {
      displaySheetName: sheet.displaySheetName,
      occupiedBeds: stats.occupiedBeds,
      availableCapacity: stats.availableCapacity,
      blockedBeds: stats.blockedBeds,
      cribs: stats.clinicalCribsCount + stats.companionCribs,
      occupancyRate: denominator > 0 ? stats.occupiedBeds / denominator : null,
      discharges: (sheet.record.discharges || []).filter(item => item.status === 'Vivo').length,
      transfers: (sheet.record.transfers || []).length,
      cma: (sheet.record.cma || []).length,
      deceased: (sheet.record.discharges || []).filter(item => item.status === 'Fallecido').length,
      specialtyCounts,
    };
  });

const buildUpcPatients = (sheets: CensusLogicalSnapshotSheet[]): UpcPatientPresentation[] => {
  const patients = new Map<string, UpcPatientAggregate>();

  sheets.forEach(sheet => {
    collectRealPatients(sheet.record).forEach(({ patient, bedCode }) => {
      if (!patient.isUPC) return;

      const key = normalizePatientKey(patient);
      if (!key) return;

      const current = patients.get(key);
      const nextDailyBeds = current?.dailyBeds ? [...current.dailyBeds] : [];
      if (!nextDailyBeds.some(entry => entry.date === sheet.record.date)) {
        nextDailyBeds.push({ date: sheet.record.date, bedCode });
      }

      if (!current) {
        patients.set(key, {
          key,
          patientName: normalizeText(patient.patientName),
          rut: normalizeText(patient.rut),
          age: normalizeText(patient.age),
          diagnosis: normalizeText(patient.pathology),
          specialty: normalizeText(patient.specialty),
          admissionDate: normalizeText(patient.admissionDate),
          firstSeenDate: sheet.record.date,
          dailyBeds: nextDailyBeds,
        });
        return;
      }

      current.dailyBeds = nextDailyBeds;
    });
  });

  return [...patients.values()]
    .map(patient => {
      const orderedBeds = sortByDate(patient.dailyBeds);
      const { history, changedBed } = buildBedHistory(orderedBeds);
      return {
        ...patient,
        dailyBeds: orderedBeds,
        totalDays: orderedBeds.length,
        daysDetail: orderedBeds.map(entry => formatDateDDMMYYYY(entry.date)).join('\n'),
        history,
        changedBed,
      };
    })
    .sort((a, b) =>
      a.firstSeenDate === b.firstSeenDate
        ? a.patientName.localeCompare(b.patientName, 'es')
        : a.firstSeenDate.localeCompare(b.firstSeenDate)
    );
};

const applyHiddenSheetProtection = async (sheet: Worksheet): Promise<void> => {
  await sheet.protect(HIDDEN_PASSWORD, SHEET_PROTECTION_OPTIONS);
  sheet.state = 'hidden';
};

const renderSummarySheet = (
  sheet: Worksheet,
  logicalSheets: CensusLogicalSnapshotSheet[],
  monthName: string,
  year: string
) => {
  const rows = buildSummaryRows(logicalSheets);
  const firstDate = logicalSheets[0]?.record.date || '';
  const lastDate = logicalSheets[logicalSheets.length - 1]?.record.date || '';

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
    const alternateFill = index % 2 === 0 ? '#FFFFFF' : '#F2F2F2';
    setRowFill(excelRow, 1, 16, alternateFill);

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

const renderUpcPatientsSheet = (
  sheet: Worksheet,
  patients: UpcPatientPresentation[],
  monthName: string,
  year: string
) => {
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

const renderUpcDailyMatrixSheet = (
  sheet: Worksheet,
  patients: UpcPatientPresentation[],
  monthName: string,
  year: string,
  daysInMonth: number
) => {
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

export const addCensusHiddenSheets = async (
  workbook: Workbook,
  snapshotSheets: CensusWorkbookSnapshotSheet[]
): Promise<void> => {
  if (snapshotSheets.length === 0) return;

  const logicalSheets = buildLogicalSnapshotSheets(snapshotSheets);
  const monthContext = getMonthContext(logicalSheets[logicalSheets.length - 1].record.date);
  const upcPatients = buildUpcPatients(logicalSheets);

  const summarySheet = workbook.addWorksheet(
    `RESUMEN ${monthContext.monthName} ${monthContext.year}`
  );
  renderSummarySheet(summarySheet, logicalSheets, monthContext.monthName, monthContext.year);

  const upcSheet = workbook.addWorksheet(
    `PACIENTES UPC ${monthContext.monthName} ${monthContext.year}`
  );
  renderUpcPatientsSheet(upcSheet, upcPatients, monthContext.monthName, monthContext.year);

  const matrixSheet = workbook.addWorksheet('DETALLE DIARIO UPC');
  renderUpcDailyMatrixSheet(
    matrixSheet,
    upcPatients,
    monthContext.monthName,
    monthContext.year,
    monthContext.daysInMonth
  );

  await applyHiddenSheetProtection(summarySheet);
  await applyHiddenSheetProtection(upcSheet);
  await applyHiddenSheetProtection(matrixSheet);
};
