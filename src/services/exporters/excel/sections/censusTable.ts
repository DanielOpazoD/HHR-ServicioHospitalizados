import type { Worksheet } from 'exceljs';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { PatientData } from '@/types/domain/patient';
import { BEDS } from '@/constants/beds';
import { getBedTypeForRecord } from '@/utils/bedTypeUtils';
import {
  TITLE_STYLE,
  HEADER_FILL,
  BORDER_THIN,
  FREE_FILL,
  BLOCKED_FILL,
  ADMISSION_FILL,
  HEADER_FONT_STYLE,
} from '../styles';
import { mapBedType, formatAge, formatDateDDMMYYYY } from '../formatters';

export function addCensusTable(sheet: Worksheet, record: DailyRecord, startRow: number): number {
  const titleRow = sheet.getRow(startRow);
  titleRow.getCell(1).value = 'TABLA DE PACIENTES HOSPITALIZADOS';
  titleRow.getCell(1).font = TITLE_STYLE;
  startRow += 1;

  const headers = [
    '#',
    'Cama',
    'Tipo',
    'Paciente',
    'RUT',
    'Edad',
    'Diagnóstico',
    'Especialidad',
    'Días',
    'F. Ingreso',
    'Estado',
    'Braz',
    'C.QX',
    'UPC',
    'Dispositivos',
    'F. CUP',
    'F. TET',
    'F. CVC',
  ];
  const headerRow = sheet.getRow(startRow);
  headers.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    cell.value = h;
    cell.font = HEADER_FONT_STYLE;
    cell.fill = HEADER_FILL;
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.border = BORDER_THIN;
  });

  let currentRow = startRow + 1;
  let index = 1;

  BEDS.forEach(bed => {
    const patient = record.beds[bed.id];
    const shouldRenderExtra = !bed.isExtra || Boolean(patient?.patientName?.trim());
    if (!shouldRenderExtra) return;

    const realBedType = getBedTypeForRecord(bed, record);
    const hasClinicalCrib = Boolean(patient?.clinicalCrib?.patientName?.trim());
    currentRow = addCensusRow(
      sheet,
      currentRow,
      index++,
      bed.id,
      realBedType,
      record.date,
      patient
    );

    if (hasClinicalCrib && patient?.clinicalCrib) {
      currentRow = addCensusRow(
        sheet,
        currentRow,
        index++,
        `${bed.id}-C`,
        'Cuna',
        record.date,
        patient.clinicalCrib,
        patient.location
      );
    }
  });

  return currentRow;
}

function addCensusRow(
  sheet: Worksheet,
  rowNumber: number,
  index: number,
  bedId: string,
  bedType: string,
  censusDate: string,
  patient?: PatientData,
  locationOverride?: string
): number {
  const row = sheet.getRow(rowNumber);
  const patientName = patient?.patientName?.trim();
  const isBlocked = Boolean(patient?.isBlocked);
  const isFree = !isBlocked && (!patient || !patientName);
  const blockedDetail = patient?.blockedReason?.trim();

  // Highlight today's admissions
  const isTodayAdmission = patient?.admissionDate === censusDate;

  // Calculate stay duration
  let stayDays = '';
  if (patient?.admissionDate && censusDate) {
    try {
      const start = new Date(patient.admissionDate);
      const end = new Date(censusDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
      stayDays = Math.max(0, diffDays).toString();
    } catch {
      stayDays = '-';
    }
  }

  // Extract device dates (DD/MM)
  const formatDeviceDate = (date?: string) => {
    if (!date) return '';
    const [, m, d] = date.split('-');
    return `${d}/${m}`;
  };

  const cupDate = formatDeviceDate(patient?.deviceDetails?.['CUP']?.installationDate);
  const tetDate = formatDeviceDate(patient?.deviceDetails?.['TET']?.installationDate);
  const cvcDate = formatDeviceDate(patient?.deviceDetails?.['CVC']?.installationDate);

  const values = [
    index,
    locationOverride ? `${bedId} (${locationOverride})` : bedId,
    mapBedType(bedType),
    isBlocked ? 'BLOQUEADA' : patient?.patientName || (isFree ? 'Libre' : ''),
    patient?.rut || '',
    formatAge(patient?.age),
    patient?.pathology || '',
    patient?.secondarySpecialty
      ? `${patient.specialty} / ${patient.secondarySpecialty}`
      : patient?.specialty || '',
    stayDays,
    formatDateDDMMYYYY(patient?.admissionDate),
    isBlocked ? 'Bloqueada' : patient?.status || (isFree ? 'Libre' : ''),
    patient ? (patient.hasWristband ? 'Sí' : 'No') : 'No',
    patient ? (patient.surgicalComplication ? 'Sí' : 'No') : 'No',
    patient ? (patient.isUPC ? 'Sí' : 'No') : 'No',
    patient?.devices?.join(', ') || '',
    cupDate,
    tetDate,
    cvcDate,
  ];

  values.forEach((value, idx) => {
    const cell = row.getCell(idx + 1);
    cell.value = value;
    const alignCenter = idx <= 2 || (idx >= 11 && idx <= 13) || idx >= 15;
    cell.alignment = {
      vertical: 'middle',
      wrapText: true,
      horizontal: alignCenter ? 'center' : 'left',
    };
    cell.border = BORDER_THIN;
    if (isBlocked) cell.fill = BLOCKED_FILL;
    if (!isBlocked && !isFree && isTodayAdmission && (idx === 1 || idx === 3)) {
      cell.fill = ADMISSION_FILL;
    }
  });

  if (isFree || isBlocked) {
    const label = isBlocked ? `Bloqueada${blockedDetail ? ` - ${blockedDetail}` : ''}` : 'Libre';
    row.getCell(4).value = label;
    row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    row.getCell(4).font = { bold: true };
    row.getCell(4).border = BORDER_THIN;
    row.getCell(4).fill = isBlocked ? BLOCKED_FILL : FREE_FILL;
    sheet.mergeCells(rowNumber, 4, rowNumber, 18);
  }

  return rowNumber + 1;
}
