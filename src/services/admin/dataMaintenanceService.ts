/**
 * Data Maintenance Service
 *
 * Provides functionality for manual JSON export and import of daily records.
 * This allows administrators to have local backups and restore data by month.
 */

import { DailyRecord } from '@/types/domain/dailyRecord';
import { saveDetailed as saveDailyRecordDetailed } from '@/services/repositories/dailyRecordRepositoryWriteService';
import { getRecordsRange, saveRecords } from '@/services/storage/records';
import * as firestoreService from '../storage/firestore';
import { logAuditEvent } from './auditService';
import { getCurrentUserEmail } from './utils/auditUtils';
import { getTodayISO } from '@/utils/dateUtils';
import { isFirestoreEnabled } from '@/services/repositories/repositoryConfig';
import { resolvePreferredDailyRecord } from '@/services/repositories/dailyRecordSyncCompatibility';
import { parseDailyRecordWithDefaultsReport } from '@/schemas/zodSchemas';
import { logger } from '@/services/utils/loggerService';

export interface MonthBackup {
  version: string;
  exportDate: string;
  year: number;
  month: number;
  recordCount: number;
  records: DailyRecord[];
}

export interface YearToDateBackup {
  version: string;
  exportDate: string;
  year: number;
  throughDate: string;
  recordCount: number;
  records: DailyRecord[];
}

export interface BackupImportResult {
  success: number;
  failed: number;
  repaired: number;
  outcome: 'clean' | 'repaired' | 'partial' | 'blocked';
}

const dataMaintenanceLogger = logger.child('DataMaintenanceService');

const monthNames = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const sortRecordsAscending = (records: DailyRecord[]): DailyRecord[] =>
  [...records].sort((left, right) => left.date.localeCompare(right.date));

const mergeRecordsByDate = (
  localRecords: DailyRecord[],
  remoteRecords: DailyRecord[]
): DailyRecord[] => {
  const dates = new Set([
    ...localRecords.map(record => record.date),
    ...remoteRecords.map(record => record.date),
  ]);
  const localMap = new Map(localRecords.map(record => [record.date, record]));
  const remoteMap = new Map(remoteRecords.map(record => [record.date, record]));

  return sortRecordsAscending(
    Array.from(dates)
      .map(date =>
        resolvePreferredDailyRecord(localMap.get(date) ?? null, remoteMap.get(date) ?? null)
      )
      .filter((record): record is DailyRecord => record !== null)
  );
};

const hydrateRangeRecords = async (startDate: string, endDate: string): Promise<DailyRecord[]> => {
  const localRecords = await getRecordsRange(startDate, endDate);

  if (!isFirestoreEnabled()) {
    return sortRecordsAscending(localRecords);
  }

  const remoteRecords = await firestoreService.getRecordsRangeFromFirestore(startDate, endDate);
  const mergedRecords = mergeRecordsByDate(localRecords, remoteRecords);

  if (mergedRecords.length > 0) {
    await saveRecords(mergedRecords);
  }

  return mergedRecords;
};

/**
 * Exports all records for a specific month as a JSON file
 */
export const exportMonthRecords = async (year: number, month: number): Promise<void> => {
  try {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = `${year}-${String(month).padStart(2, '0')}-31`;
    const records = await hydrateRangeRecords(startDate, endDate);

    if (records.length === 0) {
      throw new Error('No hay registros para exportar en este período.');
    }

    const backup: MonthBackup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      year,
      month,
      recordCount: records.length,
      records,
    };

    const monthName = monthNames[month - 1];
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const fileName = `Respaldo HHR ${monthName} ${year}.json`;
    const { saveAs } = await import('file-saver');
    saveAs(blob, fileName);

    // Audit log
    await logAuditEvent(getCurrentUserEmail(), 'DATA_EXPORTED', 'dailyRecord', `${year}-${month}`, {
      year,
      month,
      recordCount: records.length,
    });
  } catch (error) {
    dataMaintenanceLogger.error('Monthly export failed', error);
    throw error;
  }
};

/**
 * Exports all records from January 1st of a year through today when the year is current,
 * or through December 31st when exporting a past year.
 */
export const exportYearToDateRecords = async (
  year: number = new Date().getFullYear()
): Promise<void> => {
  try {
    const currentYear = new Date().getFullYear();
    const startDate = `${year}-01-01`;
    const endDate = year === currentYear ? getTodayISO() : `${year}-12-31`;
    const records = await hydrateRangeRecords(startDate, endDate);

    if (records.length === 0) {
      throw new Error('No hay registros para exportar en el rango anual seleccionado.');
    }

    const backup: YearToDateBackup = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      year,
      throughDate: endDate,
      recordCount: records.length,
      records,
    };

    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const suffix =
      year === currentYear
        ? `${monthNames[new Date().getMonth()]}_${String(new Date().getDate()).padStart(2, '0')}`
        : 'anual_completo';
    const fileName = `Respaldo HHR ${year} hasta ${suffix}.json`;
    const { saveAs } = await import('file-saver');
    saveAs(blob, fileName);

    await logAuditEvent(getCurrentUserEmail(), 'DATA_EXPORTED', 'dailyRecord', `${year}-YTD`, {
      year,
      throughDate: endDate,
      recordCount: records.length,
      exportScope: 'year-to-date',
    });
  } catch (error) {
    dataMaintenanceLogger.error('Year-to-date export failed', error);
    throw error;
  }
};

/**
 * Imports records from a backup object
 * Uses the repository to ensure Firestore sync and audit logging
 */
export const importRecordsFromBackup = async (
  backup: MonthBackup,
  onProgress?: (current: number, total: number) => void
): Promise<BackupImportResult> => {
  let success = 0;
  let failed = 0;
  let repaired = 0;

  for (let i = 0; i < backup.records.length; i++) {
    const record = backup.records[i];
    try {
      const parsed = parseDailyRecordWithDefaultsReport(record, record.date);
      const hadRepairs =
        parsed.report.nullNormalization.replacedNullCount > 0 ||
        parsed.report.nullNormalization.droppedArrayEntriesCount > 0 ||
        parsed.report.salvagedBeds.length > 0 ||
        parsed.report.droppedDischargeItems > 0 ||
        parsed.report.droppedTransferItems > 0 ||
        parsed.report.droppedCmaItems > 0;

      await saveDailyRecordDetailed(parsed.record);
      success++;
      if (hadRepairs) {
        repaired++;
      }
    } catch (error) {
      dataMaintenanceLogger.error(`Failed to import record for ${record.date}`, error);
      failed++;
    }

    if (onProgress) {
      onProgress(i + 1, backup.records.length);
    }
  }

  // Audit log
  if (success > 0) {
    const outcome = failed > 0 ? 'partial' : repaired > 0 ? 'repaired' : 'clean';
    await logAuditEvent(
      getCurrentUserEmail(),
      'DATA_IMPORTED',
      'dailyRecord',
      `${backup.year}-${backup.month}`,
      {
        year: backup.year,
        month: backup.month,
        recordCount: success,
        failedCount: failed,
        repairedCount: repaired,
        outcome,
      }
    );
  }

  const outcome =
    success === 0 ? 'blocked' : failed > 0 ? 'partial' : repaired > 0 ? 'repaired' : 'clean';

  return { success, failed, repaired, outcome };
};

/**
 * Validates if a file is a valid HHR Backup
 */
export const validateBackupFile = (content: unknown): content is MonthBackup => {
  if (!content || typeof content !== 'object') return false;
  const data = content as Record<string, unknown>;
  return (
    typeof data.version === 'string' &&
    Array.isArray(data.records) &&
    data.records.length > 0 &&
    typeof (data.records[0] as DailyRecord).date === 'string'
  );
};
