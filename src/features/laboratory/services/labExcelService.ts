/**
 * @module labExcelService
 * @description Excel export service for laboratory comparison data.
 * No React dependency — pure async function.
 */

import type { LabAnalysisData } from '@/types/domain/laboratory';
import type { ExportConfig } from '../types/labViewerTypes';
import { formatLabResult } from '../controllers/labFormattingController';

/**
 * Export the comparison table to an Excel file and trigger download.
 *
 * @param data - The processed analysis data.
 * @param config - Which dates and variables to include.
 */
export const exportComparisonToExcel = async (
  data: LabAnalysisData,
  config: ExportConfig
): Promise<void> => {
  const ExcelJS = await import('exceljs');
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Comparación Lab');

  const dates = data.examDates.filter(d => config.selectedDates.has(d));
  const vars = Object.keys(data.comparison).filter(v => config.selectedVars.has(v));

  // Header row
  ws.addRow(['Variable', ...dates]);
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, size: 10 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F5E9' } };

  // Data rows — write numbers as actual numbers so Excel doesn't flag them as text
  for (const name of vars) {
    const cells: (string | number)[] = [name];
    for (const date of dates) {
      const row = data.comparison[name]?.[date];
      if (!row) {
        cells.push('');
      } else {
        // For x10^N units, export the multiplied integer (e.g. 192000)
        const sciMatch = row.unit.match(/x10\^(\d+)/);
        if (sciMatch) {
          const exp = parseInt(sciMatch[1], 10);
          const num = parseFloat(row.result.replace(',', '.'));
          if (!isNaN(num)) {
            cells.push(Math.round(num * Math.pow(10, exp)));
            continue;
          }
        }
        // Regular numeric value
        const num = parseFloat(row.result.replace(',', '.'));
        if (!isNaN(num) && !row.result.includes('/')) {
          cells.push(num);
        } else {
          cells.push(row.result);
        }
      }
    }
    ws.addRow(cells);
  }

  // Auto-width columns
  ws.columns.forEach(col => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const len = String(cell.value || '').length;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(maxLen + 2, 30);
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `laboratorio_comparacion_${new Date().toISOString().substring(0, 10)}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
