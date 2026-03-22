import type { Worksheet } from 'exceljs';
import { DailyRecord } from '@/types/domain/dailyRecord';
import { CensusStatistics } from '../../../calculations/statsCalculator';
import { BORDER_THIN, HEADER_FILL, TITLE_STYLE } from '../styles';

export function addSummarySection(
  sheet: Worksheet,
  record: DailyRecord,
  stats: CensusStatistics,
  startRow: number
): number {
  // Calculate movement counts
  const discharges = record.discharges || [];
  const transfers = record.transfers || [];
  const cma = record.cma || [];
  const deceased = discharges.filter(d => d.status === 'Fallecido').length;
  const altas = discharges.filter(d => d.status === 'Vivo').length;

  // Row 1: Section headers
  const headerRow = sheet.getRow(startRow);
  headerRow.getCell(1).value = 'RESUMEN DE OCUPACIÓN';
  headerRow.getCell(1).font = { ...TITLE_STYLE, color: { argb: 'FFFFFFFF' } };
  headerRow.getCell(1).fill = HEADER_FILL;
  headerRow.getCell(1).alignment = { horizontal: 'center' };
  sheet.mergeCells(startRow, 1, startRow, 4);

  headerRow.getCell(5).value = 'FLUJO DE PACIENTES';
  headerRow.getCell(5).font = { ...TITLE_STYLE, color: { argb: 'FFFFFFFF' } };
  headerRow.getCell(5).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C7A7B' } }; // Teal
  headerRow.getCell(5).alignment = { horizontal: 'center' };
  sheet.mergeCells(startRow, 5, startRow, 8);

  // Row 2: Labels
  const labelRow = sheet.getRow(startRow + 1);
  const labels = [
    'Ocupadas',
    'Libres',
    'Bloqueadas',
    'Cunas Totales',
    'Altas (Vivos)',
    'Traslados',
    'Hosp. Diurna',
    'Fallecidos',
  ];
  labels.forEach((label, idx) => {
    const cell = labelRow.getCell(idx + 1);
    cell.value = label;
    cell.font = { bold: true, size: 9 };
    cell.alignment = { horizontal: 'center' };
    cell.border = BORDER_THIN;
  });

  // Row 3: Values
  const valueRow = sheet.getRow(startRow + 2);
  const values = [
    stats.occupiedBeds,
    stats.availableCapacity,
    stats.blockedBeds,
    stats.clinicalCribsCount + stats.companionCribs,
    altas,
    transfers.length,
    cma.length,
    deceased,
  ];

  values.forEach((val, idx) => {
    const cell = valueRow.getCell(idx + 1);
    cell.value = val;
    cell.alignment = { horizontal: 'center' };
    cell.font = { bold: true, size: 10 };
    cell.border = BORDER_THIN;
  });

  return startRow + 3;
}
