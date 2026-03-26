/**
 * Census Master Export Service
 * Generates a multi-sheet Excel file with one sheet per day of the month.
 * Uses the shared workbook builder to keep the email attachment and manual download in sync.
 *
 * NOTE: Password encryption only works for email attachments (server-side via Netlify Function).
 * Manual downloads are NOT encrypted because xlsx-populate doesn't work in browsers.
 */

import { DailyRecord } from '@/types/domain/dailyRecord';
import { MONTH_NAMES } from '@/constants/export';
import { getRecordsForMonth } from '@/services/storage/records';
import { getMonthRecordsFromFirestore } from '../storage/firestore';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { buildCensusMasterBinary, getCensusMasterFilename } from './censusMasterWorkbook';
import { validateExcelExport, XLSX_MIME_TYPE } from './excelValidation';
import { logger } from '@/services/utils/loggerService';

const censusMasterExportLogger = logger.child('CensusMasterExport');

/**
 * Generate and download the Census Master Excel file for a given month.
 * Fetches data from Firestore if available, otherwise falls back to localStorage.
 * Creates one worksheet per day that has data, from the first day up to the selected day.
 *
 * NOTE: This download is NOT password-protected. Only email attachments are encrypted.
 *
 * @param year - Year (e.g., 2025)
 * @param month - Month (0-indexed, e.g., 11 for December)
 * @param selectedDay - Day of the month to use as the limit (e.g., 10 means include days 1-10)
 * @throws Error if the generated Excel file is invalid
 */
export const generateCensusMasterExcel = async (
  year: number,
  month: number,
  selectedDay: number
): Promise<void> => {
  const limitDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

  let allMonthRecords: DailyRecord[] = [];

  try {
    if (isFirestoreEnabled()) {
      try {
        censusMasterExportLogger.info(
          `Loading ${MONTH_NAMES[month]} ${year} census records from Firestore`
        );
        allMonthRecords = await getMonthRecordsFromFirestore(year, month);
      } catch (remoteError) {
        censusMasterExportLogger.warn(
          'Firestore unavailable for monthly export. Falling back to local storage',
          remoteError
        );
        allMonthRecords = await getRecordsForMonth(year, month + 1);
      }
    } else {
      censusMasterExportLogger.info(
        `Loading ${MONTH_NAMES[month]} ${year} census records from local storage`
      );
      allMonthRecords = await getRecordsForMonth(year, month + 1);
    }

    const monthRecords = allMonthRecords
      .filter(record => record.date <= limitDateStr)
      .sort((a, b) => a.date.localeCompare(b.date));

    if (monthRecords.length === 0) {
      censusMasterExportLogger.warn(`No census records found for ${MONTH_NAMES[month]} ${year}`);
      alert(
        `No hay datos registrados para las fechas seleccionadas en ${MONTH_NAMES[month]} ${year}`
      );
      return;
    }

    censusMasterExportLogger.info(`Found ${monthRecords.length} census days to export`);

    const binary = await buildCensusMasterBinary(monthRecords);
    const filename = getCensusMasterFilename(limitDateStr);
    const validation = validateExcelExport(binary, filename);

    if (!validation.valid) {
      censusMasterExportLogger.error(`Excel validation failed for ${filename}`, validation.error);
      alert(
        `Error al generar el archivo Excel:\n${validation.error}\n\nPor favor, recarga la página e intenta de nuevo.`
      );
      return;
    }

    const blob = new Blob([binary], { type: XLSX_MIME_TYPE });
    const { saveAs } = await import('file-saver');
    saveAs(blob, filename);
    censusMasterExportLogger.info(
      `📥 Archivo descargado: ${filename} (${binary.byteLength} bytes)`
    );
  } catch (error) {
    censusMasterExportLogger.error('Failed to generate census master Excel', error);
    const message = error instanceof Error ? error.message : 'Error desconocido';
    alert(
      `Error al generar el archivo Excel:\n${message}\n\nPor favor, recarga la página e intenta de nuevo.`
    );
    throw error;
  }
};
