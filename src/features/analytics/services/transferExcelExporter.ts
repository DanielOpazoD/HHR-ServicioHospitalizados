import type { Worksheet } from 'exceljs';
import type { DailyRecord } from '@/features/analytics/contracts/analyticsDailyRecordContracts';
import {
  buildTransferExportRows,
  type TransferExportPeriod,
} from '@/features/analytics/controllers/transferExportController';
import { createWorkbook } from '@/services/exporters/excelUtils';
import { downloadWorkbookFile } from '@/services/exporters/excelFileDownload';

const styleHeader = (sheet: Worksheet) => {
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0284C7' } };
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  sheet.getRow(1).height = 32;
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
};

export const buildTransferWorkbook = async (
  records: DailyRecord[],
  period: TransferExportPeriod
) => {
  const rows = buildTransferExportRows(records, period);
  if (!rows.length) throw new Error('No hay traslados en el período seleccionado.');
  const workbook = await createWorkbook();
  workbook.creator = 'Hospital Hanga Roa';
  workbook.created = new Date();
  const summary = workbook.addWorksheet('Resumen');
  summary.columns = [{ width: 36 }, { width: 100 }];
  summary.addRows([
    ['TRASLADOS - HOSPITAL HANGA ROA', 'Detalle del período seleccionado'],
    ['Desde', period.startDate],
    ['Hasta', period.endDate],
    ['Total de traslados', rows.length],
    ['Criterio del período', 'Fecha del registro de censo, igual que la pestaña Traslados.'],
    ['Unidad', 'Una fila por evento de traslado activo; no son pacientes únicos.'],
    [
      'Datos históricos',
      'Solo datos del traslado y su ficha histórica; no se consulta la cama actual. Los campos no registrados quedan vacíos.',
    ],
    [
      'Fechas',
      'Texto AAAA-MM-DD sin conversión horaria. La fecha del traslado se muestra tal como fue registrada, separada de la fecha del censo.',
    ],
    [
      'Clasificación',
      'Igual que las estadísticas: Avión comercial se agrupa como LATAM; Otro se clasifica por defecto como avión ambulancia. Se conserva el texto original.',
    ],
    [
      'Hojas',
      'Todos los traslados contiene el total; las otras hojas repiten esos casos separados por modalidad. No sumar las hojas entre sí.',
    ],
  ]);
  styleHeader(summary);
  summary.getColumn(2).alignment = { wrapText: true, vertical: 'top' };

  const groups = [
    { name: 'Todos los traslados', rows },
    { name: 'LATAM', rows: rows.filter(row => row.Modalidad === 'LATAM / avión comercial') },
    { name: 'Avión ambulancia', rows: rows.filter(row => row.Modalidad === 'Avión ambulancia') },
    { name: 'Otros medios', rows: rows.filter(row => row.Modalidad === 'Otros medios') },
  ];
  const headers = Object.keys(rows[0]);
  for (const group of groups) {
    const sheet = workbook.addWorksheet(group.name);
    sheet.columns = headers.map(header => ({ header, key: header, width: 24 }));
    sheet.addRows(group.rows);
    sheet.columns.forEach(column => {
      column.numFmt = '@';
      column.alignment = { vertical: 'top', wrapText: true };
    });
    styleHeader(sheet);
    sheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: Math.max(1, sheet.rowCount), column: headers.length },
    };
    if (group.name !== 'Todos los traslados') summary.addRow([group.name, group.rows.length]);
  }
  return workbook;
};

export const exportTransfersToExcel = async (
  records: DailyRecord[],
  period: TransferExportPeriod
) =>
  downloadWorkbookFile({
    workbook: await buildTransferWorkbook(records, period),
    filename: `Detalle_Traslados_HHR_${period.startDate}_${period.endDate}.xlsx`,
  });
