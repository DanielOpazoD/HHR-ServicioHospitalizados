/**
 * CUDYR Excel Export Service
 * Orchestrates monthly summary fetch + workbook generation + output delivery.
 * Rehydrates the export range from Firestore before building the workbook.
 */

import { getCudyrMonthlyTotals } from './cudyrSummary';
import { validateExcelExport, XLSX_MIME_TYPE } from '@/services/exporters/excelValidation';
import { buildCudyrWorkbook } from './cudyrWorkbookBuilder';
import { getRecordFromFirestore } from '@/services/storage/firestore';
import { resolvePreferredDailyRecord } from '@/services/repositories/dailyRecordSyncCompatibility';
import { cudyrExportLogger } from '@/services/cudyr/cudyrLoggers';
import type { DailyRecordCudyrExportState } from '@/types/domain/dailyRecordSlices';

const fetchDailyRecord = async (dateStr: string): Promise<DailyRecordCudyrExportState | null> => {
  try {
    return await getRecordFromFirestore(dateStr);
  } catch (error) {
    cudyrExportLogger.warn(`Failed to fetch record for ${dateStr}`, error);
    return null;
  }
};

const resolveCurrentRecordForExport = async (
  endDate: string | undefined,
  currentRecord?: DailyRecordCudyrExportState | null
): Promise<DailyRecordCudyrExportState | null | undefined> => {
  if (!endDate && !currentRecord) {
    return currentRecord;
  }

  const targetDate = endDate ?? currentRecord?.date;
  if (!targetDate) {
    return currentRecord;
  }

  const remoteRecord = await fetchDailyRecord(targetDate);
  return resolvePreferredDailyRecord(currentRecord ?? null, remoteRecord);
};

const buildMonthlyWorkbook = async (
  year: number,
  month: number,
  endDate?: string,
  currentRecord?: DailyRecordCudyrExportState | null
) => {
  const hydratedCurrentRecord = await resolveCurrentRecordForExport(endDate, currentRecord);
  const monthlySummary = await getCudyrMonthlyTotals(
    year,
    month,
    endDate,
    fetchDailyRecord,
    hydratedCurrentRecord
  );

  return buildCudyrWorkbook({
    year,
    month,
    endDate,
    monthlySummary,
  });
};

export const generateCudyrMonthlyExcel = async (
  year: number,
  month: number,
  endDate?: string,
  currentRecord?: DailyRecordCudyrExportState | null
): Promise<void> => {
  const { workbook, fileName } = await buildMonthlyWorkbook(year, month, endDate, currentRecord);
  const buffer = await workbook.xlsx.writeBuffer();

  const validation = validateExcelExport(buffer, fileName);
  if (!validation.valid) {
    cudyrExportLogger.error(`Excel validation failed: ${validation.error}`);
    alert(
      `Error al generar el archivo Excel:\n${validation.error}\n\nPor favor, recarga la pagina e intenta de nuevo.`
    );
    return;
  }

  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const { saveAs } = await import('file-saver');
  saveAs(blob, fileName);
  cudyrExportLogger.warn(
    `Monthly CUDYR summary downloaded: ${fileName} (${buffer.byteLength} bytes)`
  );
};

export const generateCudyrMonthlyExcelBlob = async (
  year: number,
  month: number,
  endDate?: string,
  currentRecord?: DailyRecordCudyrExportState | null
): Promise<Blob> => {
  const { workbook } = await buildMonthlyWorkbook(year, month, endDate, currentRecord);
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: XLSX_MIME_TYPE });
};
