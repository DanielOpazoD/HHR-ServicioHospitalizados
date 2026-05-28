import type { Workbook } from 'exceljs';
import { AuditLogEntry } from '@/types/auditLogTypes';
import { createWorkbook } from './excelUtils';
import { buildClinicalAuditExportRows } from '@/services/admin/clinicalAuditExportRows';

/**
 * Generates an Excel workbook for audit logs
 */
export const generateAuditWorkbook = async (logs: AuditLogEntry[]): Promise<Workbook> => {
  const workbook = await createWorkbook();
  const sheet = workbook.addWorksheet('Auditoría Clínica Legal');

  // Header styling
  const headerRow = sheet.addRow([
    'ID',
    'FECHA/HORA',
    'RESPONSABLE',
    'IDENTIFICADOR RESPONSABLE',
    'EVENTO CLÍNICO',
    'RELATO CLÍNICO',
    'AFECTADO',
    'RUT/ID PACIENTE',
    'ORIGEN/IP',
    'ÁREA',
    'IMPACTO',
    'CAMBIOS RELEVANTES',
  ]);

  headerRow.eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4F46E5' }, // indigo-600
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
  });

  buildClinicalAuditExportRows(logs).forEach(row => {
    sheet.addRow([
      row.id,
      row.timestamp,
      row.responsible,
      row.responsibleDetail,
      row.eventTitle,
      row.narrative,
      row.affected,
      row.patientIdentifier,
      row.origin,
      row.clinicalArea,
      row.impact,
      row.relevantChanges,
    ]);
  });

  // Auto-fit columns
  sheet.columns.forEach(col => {
    let maxLen = 0;
    if (col && typeof col.eachCell === 'function') {
      col.eachCell({ includeEmpty: true }, cell => {
        const len = cell.value ? cell.value.toString().length : 0;
        if (len > maxLen) maxLen = len;
      });
    }
    col.width = Math.min(Math.max(maxLen + 2, 12), 50);
  });

  return workbook;
};
