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
import type { DailyRecordCudyrExportState } from '@/services/contracts/dailyRecordServiceContracts';

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

/**
 * Outcome of a clinical export. Services no longer render UI; the caller
 * decides how to present a 'failed' outcome (typically via useNotification).
 */
export type CudyrExcelExportOutcome =
  | { outcome: 'success'; fileName: string; byteLength: number }
  | { outcome: 'failed'; userSafeMessage: string; reason: string };

export const generateCudyrMonthlyExcel = async (
  year: number,
  month: number,
  endDate?: string,
  currentRecord?: DailyRecordCudyrExportState | null
): Promise<CudyrExcelExportOutcome> => {
  const { workbook, fileName } = await buildMonthlyWorkbook(year, month, endDate, currentRecord);
  const buffer = await workbook.xlsx.writeBuffer();

  const validation = validateExcelExport(buffer, fileName);
  if (!validation.valid) {
    cudyrExportLogger.error(`Excel validation failed: ${validation.error}`);
    return {
      outcome: 'failed',
      userSafeMessage:
        'Error al generar el archivo Excel. Por favor, recarga la página e intenta de nuevo.',
      reason: validation.error ?? 'unknown_validation_error',
    };
  }

  const blob = new Blob([buffer], { type: XLSX_MIME_TYPE });
  const { saveAs } = await import('file-saver');
  saveAs(blob, fileName);
  cudyrExportLogger.warn(
    `Monthly CUDYR summary downloaded: ${fileName} (${buffer.byteLength} bytes)`
  );
  return { outcome: 'success', fileName, byteLength: buffer.byteLength };
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
